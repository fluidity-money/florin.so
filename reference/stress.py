"""Deterministic random state-machine smoke test, no production edits.
Run from project root: PYTHONPATH=. python ../stress_review.py
Checks custody/supply invariants and full rollback after rejected Florin calls.
Not a proof of economic solvency or correct interest allocation.
"""
from decimal import Decimal as D
from copy import deepcopy
from collections import Counter
import random
from florin import Florin, StockToken, PriceFeed, pay_dividend, apply_split

counts=Counter()
for seed in range(40):
    r=random.Random(seed)
    token=StockToken()
    f=Florin(token,PriceFeed(token,D(100)))
    users=['alice','bob','carol','dave']
    for user in users:
        token.mint(user,D(200))
        f.open_trove(user,collateral=D(30),borrow=D(1000),rate=D('.06'),wall=0)
    wall=0
    for step in range(250):
        wall+=r.choice([0,1,3600,86400,604800])
        user=r.choice(users)
        op=r.choice(['open','adjust','close','deposit','withdraw','redeem','liquidate','sweep','accrue','pause','unpause','claim','surplus','price','dividend','split'])
        if op=='price':
            f.feed.move(D(r.randint(-20,20))/100);counts['price']+=1;f.check_invariants();continue
        if op=='dividend':
            pay_dividend(f.feed,f.feed.share_price/D(1000));counts['dividend']+=1;f.check_invariants();continue
        if op=='split':
            apply_split(f.feed,r.choice([D(2),D('.5')]));counts['split']+=1;f.check_invariants();continue
        amount=D(r.randint(0,500))
        collateral_delta=D(r.randint(-5,10))
        debt_delta=D(r.randint(-400,200))
        actions={
            'open':lambda:f.open_trove(user,collateral=D(20),borrow=D(500),rate=D('.07'),wall=wall),
            'adjust':lambda:f.adjust_trove(user,wall=wall,collateral_delta=collateral_delta,debt_delta=debt_delta),
            'close':lambda:f.close_trove(user,wall),
            'deposit':lambda:f.deposit_pool(user,amount,wall),
            'withdraw':lambda:f.withdraw_pool(user,amount,wall),
            'redeem':lambda:f.redeem(user,amount,wall),
            'liquidate':lambda:f.liquidate(user,wall),
            'sweep':lambda:f.liquidate_all(wall),
            'accrue':lambda:f.accrue_all(wall),
            'pause':lambda:f.pause(wall),
            'unpause':lambda:f.unpause(wall),
            'claim':lambda:f.claim_pool_gains(user),
            'surplus':lambda:f.claim_surplus(user),
        }
        before=deepcopy(f)
        try:
            actions[op]()
            counts['accepted']+=1
        except Exception as exc:
            counts['rejected']+=1
            counts['error_'+type(exc).__name__]+=1
            if f != before:
                raise AssertionError(f'Rollback failed seed={seed} step={step} op={op}: {exc}')
        try:f.check_invariants()
        except Exception as exc:raise AssertionError(f'Invariant failed seed={seed} step={step} op={op}: {exc}')
        counts['checked']+=1
print('40 seeds x 250 actions complete; no invariant or rejected-operation rollback failures.')
print(dict(counts))
