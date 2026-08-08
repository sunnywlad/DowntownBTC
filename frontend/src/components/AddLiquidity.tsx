'use client';

import { useReserves } from "@/hooks/useReserves";
import { useState } from "react";

const AddLiquidity = () => {
  const [wbtcAmount, setWbtcAmount] = useState("");
  const [cbbtcAmount, setCbbtcAmount] = useState("");
  const [lbtcAmount, setLbtcAmount] = useState("");
  const [anchor, setAnchor] = useState<number | null>(null);
  const [tolerance, setTolerance] = useState("");

  return (
    <div className="border rounded p-4 flex flex-col">

      <div className="flex flex-col my-2">
        <label htmlFor="wBTC">wBTC :</label>
        <input
          className="px-2 border rounded ml-1"
          type="text" id="wBTC"
          value={wbtcAmount}
          onChange={(e) => {
            setWbtcAmount(e.target.value);
            setAnchor(0);}}/>

        <label htmlFor="cbBTC">cbBTC :</label>
        <input
          className="px-2 border rounded ml-1"
          type="text" id="cbBTC"
          value={cbbtcAmount}
          onChange={(e) => {
            setCbbtcAmount(e.target.value);
            setAnchor(1);}}/>
        <label htmlFor="LBTC">LBTC :</label>
        <input
          className="px-2 border rounded ml-1"
          type="text" id="LBTC"
          value={lbtcAmount}
          onChange={(e) => {
            setLbtcAmount(e.target.value);
            setAnchor(2);}}/>
      </div>

      <label htmlFor="tolerance">Tolérance au slippage en % :</label>
      <input
        className="px-2 border rounded ml-1"
        type="text" id="tolerance"
        value={tolerance}
        onChange={(e) => setTolerance(e.target.value)}/>
      <button
      className='border rounded px-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 mt-2'>
        AddLiquidity
      </button>
      {useReserves().data?.map((dati, i) => <p key={i}>{dati.status} - {dati.result?.toString()}</p>)}
    </div>
  )
}

export default AddLiquidity
