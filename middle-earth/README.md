# 魔戒：中洲对决｜规则试玩

[打开 GitHub Pages 试玩](https://qiumh2323.github.io/middle-earth-duel-playtest/)

支持双人同屏热座或挑战规则电脑；无需账号或构建工具。通过静态 HTTP 服务打开，不能直接以 file:// 打开。不含扩展、跨设备联机或断点存档。

- 运行：在当前目录执行 `python -m http.server 8895 --bind 127.0.0.1`，打开 `http://127.0.0.1:8895/`。
- 核验：`node test.mjs` 检查牌阵、费用、连锁和 220 场完整对局的基本不变量。随机对局不代表每条规则都已独立验收。
- 规则出处：[Repos Production 官方规则及辅助表](https://www.rprod.com/en/games/duel-for-middle-earth)；对照官方牌阵、魔戒轨道、地图和结盟标记。
- 数据出处：[社区规则实现的基础配置](https://github.com/Vermihunter/lotr-duel-for-middle-earth/blob/783649d5d55cbffd7f2dfa342707e4c2965b7a09/src/main/resources/DefaultConfig.json)、[第二来源的章节牌卡图与 CSV](https://github.com/szuperszilard/LotR_Game/tree/8dfea9569fe4dce430a4dfc8c2e7857940ae3413/LotRpics/Done)。第二章地图议事灰牌的费用与技能已按卡面修正；全套牌效和连锁仍待逐张复核。
- 规则电脑只按公开信息估值，兼顾胜利威胁、技能、金币和区域，不使用训练模型。
- 本地和独立试玩站均可加载 `original-art/` 下的 69 张原版章节牌、卡背、封面、地图和轨道；无素材时回退为文字牌面和示意地图。独立试玩站的链接无登录限制。游戏与作品权利归各权利人所有。
- 七块原版地标取自 [GeekDad 评测](https://geekdad.com/2025/01/the-lord-of-the-rings-duel-duel-for-middle-earth-tom-bombadil-not-included/)中 Paul Benson 拍摄的地标合照；网页仅按区域裁切展示。
- 双方部队和要塞使用 [Misut Meeple 评测](https://misutmeeple.com/en/2024/10/review-the-lord-of-the-rings-duel-for-middle-earth/) 的原版棋子实拍，在网页中按棋子轮廓裁切显示。
