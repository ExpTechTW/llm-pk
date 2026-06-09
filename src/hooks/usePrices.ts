import { useEffect, useState } from "react";

import { loadPrices, type PriceMap } from "@/lib/price";

/** 載入 price.csv 的價格表(載入前回傳空 Map)。 */
export function usePrices(): PriceMap {
  const [prices, setPrices] = useState<PriceMap>(() => new Map());

  useEffect(() => {
    let active = true;
    loadPrices().then((map) => {
      if (active) setPrices(map);
    });
    return () => {
      active = false;
    };
  }, []);

  return prices;
}
