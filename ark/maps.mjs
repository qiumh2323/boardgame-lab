// Transcribed from Feuerland's Artengarten Rules DE V1, page 1.
// Origin is the entrance; cube coordinates are (q, r, -q-r).
const columns = [[-3,2,4],[-2,1,4],[-1,1,3],[0,1,3],[1,0,2],[2,-1,2],[3,-1,1]];
export const cells = columns.flatMap(([q,lo,hi]) => Array.from({length:hi-lo+1},(_,i)=>[q,lo+i]));
const legacyBAnimalBonus = typeof process !== 'undefined'
  && process.argv?.includes('--legacy-b-pouch');
export const bonusNames = {draw:'抽取 1 张',market:'任选展示版块',animal:'精选动物',shift:'行动移至 1',pouch:'获得 1 个育儿袋标记',tile:'放置 1 个开放区域',wheel:'获得 1 个保护标记',building:'拿取 1 座建筑'};
export const maps = {
  A: {
    name:'A 面 · 官方第 1 面', verified:true, cells,
    openAreas:[[-2,1],[2,2]],
    riverCells:[[-3,2],[-3,3],[-3,4],[3,-1],[3,0],[3,1]],
    bonuses:{'-3,4':'shift','3,-1':'shift','-3,2':'draw','3,1':'draw','0,3':'market'},
    source:'https://www.feuerland-spiele.de/fileadmin/game/Artengarten/Artengarten_Rules_DE_V1_Web.pdf',
  },
  B: {
    name:'B 面 · 实物第 2 面', verified:true, cells,
    openAreas:[[2,1]],
    riverCells:[[-3,2],[-3,3],[-3,4],[3,-1],[3,0],[3,1]],
    bonuses:{'-3,4':legacyBAnimalBonus?'pouch':'animal','-3,2':'tile','0,3':'shift','3,1':'wheel','3,-1':'building'},
    source:'玩家提供的实物扫描',
  },
};
