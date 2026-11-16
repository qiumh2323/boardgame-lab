# 魔戒：中洲对决｜规则试玩

双人同屏热座；无需账号、服务器或构建工具。通过静态 HTTP 服务打开，不能直接以 file:// 打开。支持基础版三章，未包含扩展、电脑对手、跨设备联机或断点存档。

- 运行：在当前目录执行 `python -m http.server 8895 --bind 127.0.0.1`，打开 `http://127.0.0.1:8895/`。
- 核验：`node test.mjs` 检查牌阵、费用、连锁和 220 场完整对局的基本不变量。随机对局不代表每条规则都已独立验收。
- 规则出处：[Repos Production 官方规则及辅助表](https://www.rprod.com/en/games/duel-for-middle-earth)；对照官方牌阵、魔戒轨道、地图和结盟标记。
- 数据出处：[社区规则实现的基础配置](https://github.com/Vermihunter/lotr-duel-for-middle-earth/blob/783649d5d55cbffd7f2dfa342707e4c2965b7a09/src/main/resources/DefaultConfig.json)、[第二来源的章节牌卡图与 CSV](https://github.com/szuperszilard/LotR_Game/tree/8dfea9569fe4dce430a4dfc8c2e7857940ae3413/LotRpics/Done)。第二章地图议事灰牌的费用与技能已按卡面修正；全套牌效和连锁仍待逐张复核。
- 非官方项目。网页使用自绘示意地图和文字牌面，不包含原版插画或原版 PDF；游戏与作品权利归各权利人所有。
