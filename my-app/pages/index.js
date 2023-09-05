import Head from 'next/head'
import Image from 'next/image'
import { Inter } from 'next/font/google'
import styles from '@/styles/Home.module.css'
import { BigNumber, Contract, ethers, providers, utils } from 'ethers';
import React, { useEffect, useRef, useState } from 'react';
import Web3Modal from "web3modal";
import { FETCH_CREATED_GAME } from '@/queries';
import { subgraphQuery } from '@/utils';
import { abi, RANDOM_GAME_NFT_CONTRACT_ADDRESS } from '@/constants';

const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  const zero = BigNumber.from("0");
  const [walletConnected, setWalletConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [entryFee, setEntryFee] = useState(zero);
  const [maxPlayers, setMaxPlayers] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [players, setPlayers] = useState([]);
  const [winner, setWinner] = useState();
  const [logs, setLogs] = useState([]);
  const web3ModalRef = useRef();

  const forceUpdate = React.useReducer(() => ({}), {})[1];

  const connectWallet = async () => {
    try {
      await getProviderOrSigner();
      setWalletConnected(true)
    } catch (err) {
      console.error(err);
    }
  };

  const getProviderOrSigner = async (needSigner = false) => {
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);
    const {chainId} = await web3Provider.getNetwork();

    if(chainId !== 80001){
      window.alert("change network to mumbai");
      throw new Error("change network to Mumbai");
    }
    if(needSigner){
      const signer = web3Provider.getSigner();
      return signer;
    }
    return web3Provider;
  };

  const startGame = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const randomGameNFTContract = new Contract(
        RANDOM_GAME_NFT_CONTRACT_ADDRESS,
        abi,
        signer
      );
      setLoading(true);
      const tx = await randomGameNFTContract.startGame(maxPlayers, entryFee);
      await tx.wait();
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const joinGame = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const randomGameNFTContract = new Contract(
        RANDOM_GAME_NFT_CONTRACT_ADDRESS,
        abi,
        signer
      );
      setLoading(true);
      const tx = await randomGameNFTContract.joinGame({
        value: entryFee,
      });
      await tx.wait();
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const checkIfGameStarted = async () => {
    try {
      const provider = await getProviderOrSigner(true);
      const randomGameNFTContract = new Contract(
        RANDOM_GAME_NFT_CONTRACT_ADDRESS,
        abi,
        provider
      );
      const _gameStarted = await randomGameNFTContract.gameStarted();
      const _gameArray = await subgraphQuery(FETCH_CREATED_GAME());
      const _game = _gameArray.games[0];
      let _logs = [];

      if(_gameStarted){
        _logs = [`Game has started with ID: ${_game.id}`];
        if(_game.players && _game.players.length > 0){
          _logs.push(
            `${_game.players.length} / ${_game.maxPlayers} already joined.`
          );
          _game.players.forEach((player) => {
            _logs.push(`${player} joined.`);
          });
        }
        setEntryFee(BigNumber.from(_game.entryFee));
        setMaxPlayers(_game.maxPlayers);
      } else if (!gameStarted && _game.winner) {
        _logs = [
          `Last game has ended with ID: ${_game.id}`,
          `Winner is player #${_game.winner}.`,
          `Waiting for host to start a new game...`
        ];
        setWinner(_game.winner);
      }
      setLogs(_logs);
      setPlayers(_game.players);
      setGameStarted(_gameStarted);
      forceUpdate();
    } catch (error) {
      console.error(error);
    }
  };

  const getOwner = async () => {
    try {
      const provider = await getProviderOrSigner(true);
      const randomGameNFTContract = new Contract(
        RANDOM_GAME_NFT_CONTRACT_ADDRESS,
        abi,
        provider
      );
      const _owner = await randomGameNFTContract.owner();
      const signer = await getProviderOrSigner(true);
      const address = await signer.getAddress();
      if(address.toLowerCase() === _owner.toLowerCase()){
        setIsOwner(true);
      }
    } catch (error) {
      console.error(error)
    }
  };

  useEffect(() => {
    if(!walletConnected){
      web3ModalRef.current = new Web3Modal({
        network: "mumbai",
        providerOptions: {},
        disableInjectedProvider: false,
      });
      connectWallet();
      getOwner();
      checkIfGameStarted();
      setInterval(() => {
        checkIfGameStarted();
      }, 2000);
    }
  }, [walletConnected]);

  const renderButton = () => {
    if (!walletConnected){
      return (
        <button onClick={connectWallet} className={styles.button}>
          Connect your wallet
        </button>
      )
    }
    if(loading){
      return <button className={styles.button}>loading....</button>
    }
    if(gameStarted){
      if(players.length === maxPlayers){
        return (
          <button className={styles.button} disabled>
            choosing winner...
          </button>
        )
      }
      return (
        <button className={styles.button} onClick={joinGame}>
          Join game
        </button>
      )
    }

    if(isOwner && !gameStarted){
      return (
        <div>
          <input
            type="number"
            className={styles.input}
            onChange={(e) => {
              setEntryFee(
                e.target.value >= 0 ? utils.parseEther(e.target.value.toString()) : zero
              );
            }}
            placeholder='Entry fee (ETH)'
            />
          <input 
            type="number"
            className={styles.input}
            onChange={(e) => {
              setMaxPlayers(e.target.value ?? 0);
            }}
            placeholder='max players'
            />
            <button className={styles.button} onClick={startGame}>
              start game
            </button>
        </div>
      );
    }
  };

  return (
    <>
      <Head>
        <title>LW3Punks</title>
        <meta name="description" content="LW3Punks Dapp" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={`${styles.main} ${inter.className}`}>
        <div>
          <h1 className={styles.title}>Welcome to Random Winner Game!</h1>
          <div className={styles.description}>
            It's a lottery game where a winner is chosen at random and wins the entire lottery pool.
          </div>
          {renderButton()}
          {logs && 
            logs.map((log, index) => (
              <div className={styles.log} key={index}>
                {log}
              </div>
            ))
          }
        </div>
        <div>
          <img className={styles.image} src="./randomWinner.png" />
        </div>
      </main>

      <footer className={styles.footer}>!Made with &#10084; by bohemian-x</footer>
    </>
  )
}
