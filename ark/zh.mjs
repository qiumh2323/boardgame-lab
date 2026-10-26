// Chinese working translations; stable tile IDs remain the rules/data identity.
const names = `狮子|狮子|澳洲野犬|澳洲野犬|欧亚水獭|欧亚水獭|狞猫|澳大利亚海狮|欧亚棕熊|苏门答腊虎|苏门答腊虎|美洲豹|美洲豹|双角犀鸟|笑翠鸟|鞭笞巨嘴鸟|雪鸮|非洲鸵鸟|大红鹳|白鹳|白鹳|绯红金刚鹦鹉|绯红金刚鹦鹉|澳洲鹈鹕|澳洲鹈鹕|绿孔雀|大熊猫|印度犀牛|印度犀牛|非洲草原象|阿尔卑斯北山羊|阿尔卑斯北山羊|赤颈袋鼠|水豚|水豚|北部长颈鹿|北部长颈鹿|考拉|考拉|澳洲魔蜥|澳洲魔蜥|中国水龙蜥|加拉帕戈斯象龟|尼罗鳄|尼罗鳄|绿鬣蜥|美洲变色蜥|欧洲泽龟|欧洲壁蜥|印度蟒|印度蟒|内陆太攀蛇|巴巴里猕猴|巴巴里猕猴|圭亚那蜘蛛猴|圭亚那蜘蛛猴|阿拉伯狒狒|阿拉伯狒狒|日本猕猴|暗色叶猴|暗色叶猴|东非黑白疣猴|松鼠猴|迷你猪|驴|绵羊|矮种马|山羊|羊驼|家兔|水域学家|地质学家|树木学家|捕食者专家|爬行动物学家|灵长类学家|食草动物专家|鸟类学家|小型动物专家|大型动物专家|非洲伙伴动物园|亚洲伙伴动物园|欧洲伙伴动物园|美洲伙伴动物园|澳洲伙伴动物园|安博塞利国家公园|奇特旺国家公园|黄石国家公园|湖区国家公园|坎贝尔港国家公园|峡谷|稀树草原|低山地带|丛林|竹林|鸟类繁育|食草类繁育|灵长类繁育|捕食者繁育|爬行类繁育|澳洲内陆区|阿尔卑斯区|苏门答腊区|奥卡万戈区|亚马孙区|捕食者馆|灵长类馆|鸟栖树|爬行动物馆|食草动物馆|攀爬森林|空中缆车|水族馆|水上乐园|树屋|冒险乐园|观景台|观景台|观景台|管理处|隐蔽玻璃墙|亚洲展馆|美洲展馆|非洲展馆|欧洲展馆|澳洲展馆|公园|会议厅|动物园厨房|展览厅|图书馆|动物园学校|喷泉|挖掘场|雕像`.split('|');
export const labels = {projects:'项目',forest:'森林',water:'水域',rock:'岩地',animal:'动物',project:'项目',building:'建筑',africa:'非洲',asia:'亚洲',europe:'欧洲',australia:'澳洲',americas:'美洲',america:'美洲',predator:'捕食者',herbivore:'食草类',bird:'鸟类',reptile:'爬行类',primate:'灵长类',mountain:'岩地',open:'开放区域',pet:'宠物',different:'不同种类',top:'上方',bottom:'下方','upper-left':'左上方','upper-right':'右上方','lower-left':'左下方','lower-right':'右下方'};
export const label = v => labels[v] || v;
export function tileName(tile) {
  const name = names[Number(tile.tile_id)-1];
  if (!name) throw Error(`版块 ${tile.tile_id} 缺少中文名称`);
  return name;
}
const phrases = {
  'by the River':'必须放在临河格（地图最左侧或最右侧的三个格子）',
  'have tiles on all spaces by the River':'六个临河格必须均已放置版块',
  'discard 4 tiles':'弃置四张手牌',
  'have at least 7 tiles in hand':'手牌至少有七张',
  'have 10 different animal and/or continent icons':'拥有十种不同的动物类别或大陆图标',
  'have 5 different animal icons':'拥有五种不同的动物类别图标',
  'have 5 different continent icons':'拥有五种不同的大陆图标',
  'next to 2 Buildings':'与两座建筑相邻',
  'next to 2 Projects':'与两个项目相邻',
  'next to 2 Large Animals':'与两只大型动物（等级四或五）相邻',
  'next to 2 placement-bonus spaces':'与两个印有放置奖励的格子相邻',
  'next to 4 different adjacent animal and/or continent icons':'相邻版块合计具有至少四种不同的动物类别或大陆图标',
  'discard 1 tile to gain 1 pouch marker':'可弃置一张手牌，获得一个育儿袋标记',
  'discard up to 2 tiles; gain 1 pouch marker for each':'可弃置至多两张手牌，每弃一张获得一个育儿袋标记',
  'draw 1 tile from the pile':'从牌堆抽取一张版块',
  'draw 2 tiles from the pile':'从牌堆抽取两张版块',
  'draw 3 tiles from the pile; keep 1 Animal':'从牌堆抽取三张版块，保留其中一张动物版块，其余弃置',
  'gain 1 conservation marker':'获得一个保护标记',
  'gain 2 conservation markers':'获得两个保护标记',
  'gain 2 conservation markers for a released level 2/3 Animal, or 3 for level 4/5':'放归等级二或三的动物获得两个保护标记；放归等级四或五的动物获得三个',
  'move 1 Action to strength 1':'本次行动结算完成后，可将一张行动牌移至强度一，其余行动牌依次右移',
  'place 1 Open Area from the pile in your zoo':'从牌堆取一张版块，背面朝上放置为开放区域',
  'place 2 Open Areas from the pile in your zoo':'从牌堆取两张版块，依次背面朝上放置为开放区域',
  'relocate 1 tile in your zoo':'移动保护区内的一张版块到新的合法位置',
  'take 1 Animal from the display':'从展示区任选一张动物版块',
  'take 1 Building from the display':'从展示区任选一张建筑版块',
  'take 1 Project from the display':'从展示区任选一张项目版块',
  'take 1 Project from the display; gain 1 conservation marker':'从展示区任选一张项目版块，并获得一个保护标记',
  'take 1 Large Animal from the display':'从展示区任选一张大型动物版块（等级四或五）',
  'take 1 Small Animal from the display':'从展示区任选一张小型动物版块（等级二或三）',
  'take 1 tile from the display':'从展示区任选一张版块',
  'take all Buildings from the display':'拿取展示区的全部建筑版块',
  'take all Projects from the display':'拿取展示区的全部项目版块',
  'tiles of level 2 or 3 require 1 less action strength':'打出等级二或三的版块时，所需行动强度降低一',
  'tiles of level 4 or 5 require 1 less action strength':'打出等级四或五的版块时，所需行动强度降低一',
};
export function describe(text) {
  if (!text) return '—';
  if (phrases[text]) return phrases[text];
  let m;
  if ((m = text.match(/^next to (\d+) (\w+) icons?$/))) return `与至少 ${m[1]} 个${label(m[2].toLowerCase())}图标相邻`;
  if ((m = text.match(/^next to a connected (\w+) area of at least 4 tiles$/))) return `与至少四张版块组成的连通${label(m[1].toLowerCase())}区域相邻`;
  if ((m = text.match(/^release 1 Animal with the (\w+) icon$/))) return `覆盖并放归一只具有${label(m[1])}图标的动物`;
  if ((m = text.match(/^take 1 tile with an (\w+) icon from the display$/))) return `从展示区任选一张具有${label(m[1])}图标的版块`;
  if ((m = text.match(/^tiles with (?:a|an) (\w+) icon require (\d+) less action strength$/))) return `打出具有${label(m[1])}图标的版块时，所需行动强度降低 ${m[2]}`;
  if ((m = text.match(/^after playing a tile with a (\w+) icon: (.+)$/))) return `每当打出具有${label(m[1])}图标的版块后：${describe(m[2])}`;
  throw Error(`缺少中文说明：${text}`);
}
