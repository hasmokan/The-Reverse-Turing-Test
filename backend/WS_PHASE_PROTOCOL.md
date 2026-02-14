# WebSocket 房间阶段协议（投票阶段信号）

目标：让前端能实时展示“投票阶段开始/结束”的倒计时，并在投票阶段禁用提交画作入口。

## 1) 房间阶段（phase）

后端通过 Socket 下发的 `phase` 字段取值：
- `active`：提交/观赏阶段（允许提交画作；不一定允许投票）
- `voting`：投票阶段（不允许提交画作；允许投票/撤票）
- `gameover`：结算结束

后端落库字段：`rooms.status`。

## 2) 事件：sync:state（进入房间时全量同步）

事件名：`sync:state`

触发：客户端 `room:join` 后，服务端会 emit 给该 socket。

Payload（camelCase，新增字段对旧前端向后兼容）：  
- `phase: string`（`active`/`voting`/`gameover`）  
- `roomId: string`  
- `totalItems: number`  
- `aiCount: number`  
- `turbidity: number`  
- `theme: ThemeResponse`  
- `items: GameItemData[]`  
- `votingStartedAt?: number`（Unix 毫秒时间戳，仅 voting 期存在）  
- `votingEndsAt?: number`（Unix 毫秒时间戳，仅 voting 期存在）  
- `serverTime: number`（Unix 毫秒时间戳，服务端当前时间）  

示例（voting 中）：
```json
{
  "phase": "voting",
  "roomId": "ABCD12",
  "totalItems": 8,
  "aiCount": 2,
  "turbidity": 0.4,
  "votingStartedAt": 1769948000000,
  "votingEndsAt": 1769948045000,
  "serverTime": 1769948012345,
  "theme": { "...": "..." },
  "items": []
}
```

## 3) 事件：phase:update（房间内广播阶段切换）

事件名：`phase:update`

触发：服务端在以下时机会向 `within(roomId)` 广播给同房间所有连接：  
- `active -> voting`：进入投票阶段  
- `voting -> active`：投票超时且未结束游戏，重置票数并退出投票阶段  
- `* -> gameover`：胜负判定落库 gameover 后立即广播  

Payload（camelCase）：  
- `phase: string`  
- `roomId: string`  
- `votingStartedAt?: number`（Unix ms）  
- `votingEndsAt?: number`（Unix ms）  
- `serverTime: number`（Unix ms）  

示例（进入 voting）：
```json
{
  "phase": "voting",
  "roomId": "ABCD12",
  "votingStartedAt": 1769948000000,
  "votingEndsAt": 1769948045000,
  "serverTime": 1769948000001
}
```

示例（退出 voting 回到 active）：
```json
{
  "phase": "active",
  "roomId": "ABCD12",
  "serverTime": 1769948050000
}
```

示例（gameover）：
```json
{
  "phase": "gameover",
  "roomId": "ABCD12",
  "serverTime": 1769948060000
}
```

## 4) 前端倒计时推荐算法

服务端同时提供 `votingEndsAt` 与 `serverTime`，用于抵消客户端/服务器时钟偏差。

推荐做法：
1. 记录收到消息时的本地时间 `clientNowAtReceive = Date.now()` 与消息中的 `serverTime`。
2. 估算服务器与客户端的时间偏移：`offset = serverTime - clientNowAtReceive`。
3. 后续倒计时使用：`remainingMs = votingEndsAt - (Date.now() + offset)`。

若前端不做校时，也可直接：`remainingMs = votingEndsAt - Date.now()`（误差会更大）。

## 5) 禁提交与兼容性说明

- 后端在 `voting` 阶段会拒绝 `POST /api/rooms/:room_code/drawings`（HTTP 400），因此旧前端即便未禁用按钮，也不会提交成功。
- 新增字段/新事件均为增量：旧前端忽略未知字段/事件即可继续运行。
