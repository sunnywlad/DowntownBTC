'use client'
import React from 'react';
import {useConnection} from 'wagmi';

const Connection = ({children}: {children: React.ReactNode}) => {
  const connection = useConnection();

  if (connection.status === 'connected') {
    return (
      <>
        {children}
      </>
    )
  } else if (connection.status ==='disconnected') {
    return (
      <>
      Please connect your wallet
      </>
    )
  } else {
    return (
      <>
      Loading
      </>
    )
  }
};

export default Connection;
