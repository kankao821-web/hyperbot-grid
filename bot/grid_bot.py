"""Prototype de placement d'un seul ordre d'achat GRID Spot sur Hyperliquid TESTNET.
Lecture seule par défaut. Aucune vente automatique. Ne pas utiliser sur mainnet.
"""
import argparse
import os
import time
from decimal import Decimal, ROUND_DOWN
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name('.env'))

TESTNET_URL = "https://api.hyperliquid-testnet.xyz"


def dec(name, default):
    return Decimal(os.getenv(name, str(default)))


def market_from_meta(meta):
    tokens = {t["index"]: t for t in meta["tokens"]}
    for item in meta["universe"]:
        a, b = item["tokens"]
        if tokens[a]["name"] == "UBTC" and tokens[b]["name"] == "USDC":
            return item, tokens[a], tokens[b]
    raise RuntimeError("Paire UBTC/USDC absente du testnet : aucun ordre envoyé")


def main():
    parser = argparse.ArgumentParser(description="HyperBot GRID testnet, lecture seule par défaut")
    parser.add_argument("--execute", action="store_true", help="Autoriser un ordre TESTNET après confirmation")
    args = parser.parse_args()
    capital = dec("HL_CAPITAL_USDC", 100)
    levels = int(os.getenv("HL_LEVELS", "4"))
    amplitude = dec("HL_RANGE_PCT", 6) / 100
    allocation = dec("HL_ALLOCATION_PCT", 60) / 100
    min_order = dec("HL_MIN_ORDER_USDC", 10)
    max_order = dec("HL_MAX_ORDER_USDC", 25)
    poll = int(os.getenv("HL_POLL_SECONDS", "15"))
    if not (0 < capital <= 1000 and 2 <= levels <= 20 and 0 < amplitude <= Decimal(".3")
            and 0 < allocation <= Decimal(".8") and 0 < min_order <= max_order <= 50
            and 10 <= poll <= 300):
        raise ValueError("Paramètres hors des limites de sécurité")
    account = os.getenv("HL_ACCOUNT_ADDRESS", "").strip()
    if not (account.startswith("0x") and len(account) == 42):
        raise ValueError("HL_ACCOUNT_ADDRESS : adresse du compte principal testnet requise")
    if args.execute:
        if input("Taper TESTNET pour autoriser UN ordre d'achat TESTNET : ").strip() != "TESTNET":
            raise SystemExit("Annulé")
        key = os.getenv("HL_AGENT_PRIVATE_KEY", "")
        if not (key.startswith("0x") and len(key) == 66):
            raise ValueError("Clé API Wallet testnet manquante")
    from hyperliquid.info import Info
    info = Info(TESTNET_URL, skip_ws=True)
    market, btc_token, _ = market_from_meta(info.spot_meta())
    coin = market["name"]
    print("Réseau TESTNET | paire", coin, "| lecture seule", not args.execute)
    exchange = None
    if args.execute:
        from eth_account import Account
        from hyperliquid.exchange import Exchange
        wallet = Account.from_key(os.environ["HL_AGENT_PRIVATE_KEY"])
        exchange = Exchange(wallet, TESTNET_URL, account_address=account)
    while True:
        try:
            mids = info.all_mids()
            price = Decimal(str(mids[coin]))
            step = (2 * amplitude * price) / levels
            target = price - step
            if target <= 0:
                raise RuntimeError("Prix cible invalide")
            # Taille et prix arrondis conservativement; le serveur peut refuser
            # si les règles de tick/lot du marché sont plus strictes.
            size_decimals = int(btc_token["szDecimals"])
            size_unit = Decimal(1).scaleb(-size_decimals)
            amount = min(capital * allocation / levels, max_order)
            size = (amount / target).quantize(size_unit, rounding=ROUND_DOWN)
            px = target.quantize(Decimal("0.1"), rounding=ROUND_DOWN)
            notional = size * px
            balances = info.spot_user_state(account).get("balances", [])
            usdc = sum((Decimal(str(b["total"])) - Decimal(str(b.get("hold", "0")))
                        for b in balances if b["coin"] == "USDC"), Decimal(0))
            open_orders = [o for o in info.open_orders(account) if o.get("coin") == coin]
            print(f"Spot {price} | achat limite {size} UBTC @ {px} | notionnel {notional:.2f} USDC | solde dispo {usdc} | ordres ouverts {len(open_orders)}")
            if not args.execute:
                break
            if open_orders:
                print("Ordre déjà ouvert : aucun nouvel ordre.")
                break
            if notional < min_order or notional > max_order or notional > usdc:
                print("Ordre bloqué : montant minimum, plafond ou solde insuffisant.")
                break
            result = exchange.order(coin, True, float(size), float(px), {"limit": {"tif": "Gtc"}})
            print("Réponse testnet :", result)
            if result.get("status") != "ok" or any("error" in s for s in result.get("response", {}).get("data", {}).get("statuses", [])):
                raise RuntimeError("Ordre rejeté par le testnet")
            print("Un seul ordre envoyé. Vérifier son état avant de relancer.")
            break
        except KeyboardInterrupt:
            print("Arrêt demandé.")
            break
        except Exception as exc:
            print("ERREUR : arrêt sécurisé :", type(exc).__name__, str(exc))
            raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
