# steps：
### 1，contract deploy(optional)
```
./deploy.sh
```

### 2, init accounts(optional)
```
yarn init_account
```

### 3, stress test
```
yarn stress_test
```

# config
```
{
    "taskRoutineNum": 100,
    "inactiveAccNum": 900,
    "taskReplayNum": 8,
    "rawTransferSize": 40,
    "erc20TransferSize": 40,
    "swapBatchSize": 20,
    "accountBatchNum":200,
    "pairNum":3,
    "sendBatch":100
}
```
## key param:
### account
"taskRoutineNum": sender number each task

"inactiveAccNum": inactive account number each task

"accountBatchNum": total task batch number

sender account number = taskRoutineNum * accountBatchNum

inactive account number = inactiveAccNum * accountBatchNum
### tx percent
"rawTransferSize": 40,

"erc20TransferSize": 40,

"swapBatchSize": 20,

note: Sum of thress param above shoule be 100
### batch size
 "sendBatch": tx num each send
 # tool
 check gas used
 ```
node tools/getBlocks.js | grep -E 'gasLimit|gasUsed|number'
 ```