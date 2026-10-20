// English and Bangla text.
const en = {
  tagline: 'Tiffin break edition', play: 'Play', leaderboard: 'Leaderboard', stats: 'Stats', settings: 'Settings',
  whoPlaying: 'Who is playing?', vsc: 'vs Computer', vscSub: 'You against the desk champion.',
  two: '2 players', twoSub: 'One device. Take turns to flick.', online: 'Online', onlineSub: 'Play a friend or anyone, anywhere.',
  pickPen: 'Pick your pen', classic: 'Classic', real: 'Real', editName: 'tap to edit', computer: 'Computer',
  easy: 'Easy', normal: 'Normal', hard: 'Hard', matchRules: 'Match rules', equalLevels: 'Equal levels',
  mirror: 'Mirror match', mirrorSub: 'Both players use the same pen.', rounds: 'Rounds to win', fight: 'Fight',
  quickMatch: 'Quick match', createRoom: 'Create room', join: 'Join', shareCode: 'Share this code with your friend',
  copyLink: 'Copy invite link', share: 'Share', me: 'Me', world: 'World', makeYours: 'Make it yours', screen: 'Screen',
  theme: 'Theme', system: 'System', light: 'Light', dark: 'Dark', language: 'Language', desk: 'Desk',
  cleanDesk: 'Clean desk', oldDesk: 'Old school desk', penLook: 'Pen look', playLabel: 'Play',
  aimGuide: 'Aim guide', aimGuideSub: 'Arrow, path and spin. Off keeps the power bar.', sound: 'Sound', soundSub: 'Clicks, hits and cheers.',
  reduceMotion: 'Reduce motion', reduceMotionSub: 'No shake, zoom or moving effects.', vibration: 'Vibration',
  vibrationSub: 'A light buzz while you pull.', autoNext: 'Automatic next match', autoNextSub: 'Starts 5 seconds after a win.',
  fullscreen: 'Full screen', fullscreenSub: 'Fills the screen. Esc leaves it.', progress: 'Progress',
  backup: 'Back up progress', restore: 'Restore', resetAll: 'Reset all progress', howToPlay: 'How to play',
  paused: 'Paused', resume: 'Resume', restart: 'Restart match', quit: 'Quit to menu', rematch: 'Rematch',
  changePen: 'Change pen', menu: 'Menu',

  you: 'You', computerName: 'Computer', player1: 'Player 1', player2: 'Player 2',
  q_nice: 'Nice shot!', q_gg: 'GG', q_oops: 'Oops!',
  yourTurn: 'Your turn', turnOf: "{name}'s turn", thinking: 'Computer is thinking…', aiming: '{name} is aiming…',
  youWin: 'You won!', nameWon: '{name} won', winsP: '{name} wins!', roundWin: '{name} takes the round',
  roundYou: 'You take the round!', roundDraw: 'Both fell!', roundDrawSub: 'Replay the round', deskShrinks: 'The desk shrinks!',
  roundN: 'Round {n}', firstTo: 'First to {n}', fightBang: 'Fight!', playedN: 'Played {n}', onlineNow: '{n} online now',
  levelUp: '{pen} reached Lv{n}!', opponentLeft: 'Your opponent left. You win!', searching: 'Looking for a player…',
  searchingSub: 'Anyone who taps Quick match joins you.', waitingFriend: 'Waiting for your friend…', waitingSub: 'The match starts as soon as they join.',
  roomNotFound: 'No room with that code.', roomFull: 'That room is full.', noServer: 'Online needs the game server (npm start).',
  connecting: 'Connecting…', linkCopied: 'Invite link copied!', timeUp: "Time's up! Turn passed.",
  equalOn: 'Both pens play at Lv1.', equalOff: 'Each pen plays at its own level.', firstHint: 'Grab your pen, pull back and let go!',
  rematchWait: 'Waiting for {name}…', rematchAsk: '{name} wants a rematch!', autoNextIn: 'Next match in {n}s', enterCode: 'Enter the 5-letter code',
  time: 'Time', shots: 'Shots', score: 'Score', level: 'Level', selfOut: 'Fell off on their own shot',
  timePlayed: 'Time played', avgMatch: 'Average match', fastestWin: 'Fastest win', longestMatch: 'Longest match',
  byLevel: 'By level', averageMatch: 'Average match', countingFromNow: 'Counting from now', savedDevice: 'Saved on this device only',
  played: 'Played', won: 'Won', lost: 'Lost', draws: 'Draws', winRate: 'Win rate', bestStreak: 'Best streak', streakNow: 'Streak now',
  playedWonRate: 'Played · Won · Win rate', bestPerPen: 'Best per pen', playedWins: 'Played · Wins', notPlayed: 'Not played yet',
  pw: '{p} played · {w} wins', noMatches: 'No matches yet', noMatchesSub: 'Your finished matches will show up here.',
  players: 'Players', matches: 'Matches', visits: 'Visits', hoursPlayed: 'Hours played', timeOnSite: 'Time on site', onlineNowL: 'Online now',
  vscWorld: 'vs Computer worldwide', playersWon: 'Players won', computerWon: 'Computer won', wld: 'Won · Lost · Draws',
  updatedEvery: 'Updated live from the game server', worldOffline: 'World stats need the game server.', topPlayers: 'Top online players',
  yourOnline: 'Your online record', noOnline: 'No online matches yet. Be the first!', wl: '{w} W · {l} L',
  power: 'Power', weight: 'Weight', roll: 'Roll', length: 'Length', winsOnPen: 'Wins with this pen', nextLevel: '{n} more wins to Lv{l}', maxLevel: 'Max level!',
  backupTitle: 'Back up progress', backupSub: 'Copy this code and keep it safe. Paste it in Restore on any device.',
  restoreTitle: 'Restore progress', restoreSub: 'Paste a backup code.', restoreOk: 'Progress restored!', restoreBad: 'That code did not work.',
  resetConfirm: 'Delete all stats and pen levels on this device?', resetDone: 'Progress reset.', copy: 'Copy', copied: 'Copied!',
  min: '{n} min', sec: '{n} s', ago: '{t} ago', justNow: 'just now', vsComputerChip: 'vs Computer', twoChip: '2 players', onlineChip: 'Online',
  turnTimer: 'Turn timer', tutorialAgain: 'Play a practice match', tutorialSub: 'A match against the Easy computer.', back: 'Back',
  serverHint: 'Online · needs server',
  help: [
    ['Goal', 'goal', ['Knock their pen off the desk. Keep yours on.', 'A pen falls when its middle leaves the desk.']],
    ['How to flick', 'flick', ['Grab your pen, pull back and let go. The pen shoots the other way.', 'Pull further for more power. At the screen edge, hold the pull and the power keeps rising. A tiny pull cancels.', 'Grab near a tip to spin. Grab the middle to push it straight.', 'A side flick rolls far. A push along the pen is much weaker.']],
    ['Turns', null, ['Players take turns. One flick per turn.', 'Online, every turn has a 30 second timer. If it runs out, the turn passes.']],
    ['Winning', null, ['Knock their pen off and you win the round. If your own pen falls, they win it.', 'If both fall, the round is replayed.', 'Win the set number of rounds to win the match.']],
    ['The desk shrinks', 'shrink', ['After 6 flicks in a round, the desk gets smaller every 2 flicks.', 'A red dashed line shows the next edge. Pens outside it fall when it shrinks.']],
    ['Pens', null, ['Every pen plays differently: long pens roll far, fat pens are heavy, light pens fly fast.', 'Tap the i on the pen card to see its power, weight and roll.']],
    ['Levels and progress', null, ['Every 3 wins against the computer with a pen raises its level (up to Lv5).', 'Each level adds a little power and weight.']],
    ['Classic and Real look', null, ['Classic draws cartoon pens with outlines. Real draws shiny, realistic pens. It only changes the look.']],
    ['Equal levels and Mirror match', null, ['Equal levels: both pens play at Lv1, so only skill counts.', 'Mirror match: the computer uses the same pen as you.']],
    ['vs Computer levels', null, ['Easy makes many mistakes. Normal is a fair fight. Hard plans every shot.']],
    ['2 players', null, ['Share one device and take turns. Pick a pen for each player.']],
    ['Online', null, ['Quick match pairs you with anyone who is waiting.', 'Create room gives you a code and a link for a friend. Online pens always play at equal levels.']],
    ['Tips', null, ['Flick across the pen, not along it.', 'Hit their pen near an end to send it spinning.', 'A soft shot that stays on beats a big one that flies off.', 'Stay away from the edge, most of all late in the round.', 'The aim guide in Settings shows where your pen will go.'], true],
  ],
};

const bn = {
  tagline: 'টিফিন পিরিয়ড এডিশন', play: 'খেলো', leaderboard: 'লিডারবোর্ড', stats: 'পরিসংখ্যান', settings: 'সেটিংস',
  whoPlaying: 'কে খেলবে?', vsc: 'কম্পিউটারের সাথে', vscSub: 'বেঞ্চের চ্যাম্পিয়নের বিরুদ্ধে তুমি।',
  two: '২ জন খেলোয়াড়', twoSub: 'একই ডিভাইস। পালা করে মারো।', online: 'অনলাইন', onlineSub: 'বন্ধু বা যে কারো সাথে, যেকোনো জায়গা থেকে।',
  pickPen: 'কলম বেছে নাও', classic: 'ক্লাসিক', real: 'রিয়েল', editName: 'নাম বদলাতে চাপো', computer: 'কম্পিউটার',
  easy: 'সহজ', normal: 'মাঝারি', hard: 'কঠিন', matchRules: 'ম্যাচের নিয়ম', equalLevels: 'সমান লেভেল',
  mirror: 'মিরর ম্যাচ', mirrorSub: 'দুজনেই একই কলম নেবে।', rounds: 'জিততে কত রাউন্ড', fight: 'লড়াই',
  quickMatch: 'কুইক ম্যাচ', createRoom: 'রুম বানাও', join: 'যোগ দাও', shareCode: 'এই কোডটা বন্ধুকে পাঠাও',
  copyLink: 'ইনভাইট লিংক কপি', share: 'শেয়ার', me: 'আমি', world: 'বিশ্ব', makeYours: 'নিজের মতো সাজাও', screen: 'স্ক্রিন',
  theme: 'থিম', system: 'সিস্টেম', light: 'লাইট', dark: 'ডার্ক', language: 'ভাষা', desk: 'বেঞ্চ',
  cleanDesk: 'পরিষ্কার বেঞ্চ', oldDesk: 'পুরনো স্কুল বেঞ্চ', penLook: 'কলমের লুক', playLabel: 'খেলা',
  aimGuide: 'নিশানা গাইড', aimGuideSub: 'তীর, পথ আর ঘূর্ণি দেখায়। বন্ধ করলে শুধু পাওয়ার বার।', sound: 'সাউন্ড', soundSub: 'ক্লিক, ধাক্কা আর জয়ের আওয়াজ।',
  reduceMotion: 'কম মুভমেন্ট', reduceMotionSub: 'কাঁপুনি, জুম বা নড়াচড়া নেই।', vibration: 'ভাইব্রেশন',
  vibrationSub: 'টানার সময় হালকা কাঁপুনি।', autoNext: 'অটো পরের ম্যাচ', autoNextSub: 'জেতার ৫ সেকেন্ড পর শুরু হয়।',
  fullscreen: 'ফুল স্ক্রিন', fullscreenSub: 'পুরো স্ক্রিন জুড়ে। Esc চাপলে বের হবে।', progress: 'অগ্রগতি',
  backup: 'ব্যাকআপ নাও', restore: 'ফিরিয়ে আনো', resetAll: 'সব অগ্রগতি মুছে দাও', howToPlay: 'কীভাবে খেলবে',
  paused: 'বিরতি', resume: 'চালিয়ে যাও', restart: 'আবার শুরু', quit: 'মেনুতে ফেরো', rematch: 'আবার খেলো',
  changePen: 'কলম বদলাও', menu: 'মেনু',

  you: 'তুমি', computerName: 'কম্পিউটার', player1: 'খেলোয়াড় ১', player2: 'খেলোয়াড় ২',
  q_nice: 'দারুণ শট!', q_gg: 'GG', q_oops: 'উফ!',
  yourTurn: 'তোমার পালা', turnOf: '{name}-এর পালা', thinking: 'কম্পিউটার ভাবছে…', aiming: '{name} নিশানা করছে…',
  youWin: 'তুমি জিতেছ!', nameWon: '{name} জিতেছে', winsP: '{name} জিতেছে!', roundWin: 'রাউন্ড {name}-এর',
  roundYou: 'রাউন্ড তোমার!', roundDraw: 'দুটোই পড়ে গেছে!', roundDrawSub: 'রাউন্ড আবার হবে', deskShrinks: 'বেঞ্চ ছোট হচ্ছে!',
  roundN: 'রাউন্ড {n}', firstTo: 'প্রথমে {n} জিতলে', fightBang: 'শুরু!', playedN: '{n} বার খেলেছ', onlineNow: 'এখন {n} জন অনলাইনে',
  levelUp: '{pen} এখন Lv{n}!', opponentLeft: 'প্রতিপক্ষ চলে গেছে। তুমি জিতেছ!', searching: 'খেলোয়াড় খোঁজা হচ্ছে…',
  searchingSub: 'যে কেউ কুইক ম্যাচ চাপলেই তোমার সাথে খেলবে।', waitingFriend: 'বন্ধুর জন্য অপেক্ষা…', waitingSub: 'বন্ধু যোগ দিলেই ম্যাচ শুরু।',
  roomNotFound: 'এই কোডে কোনো রুম নেই।', roomFull: 'রুমটা ভরা।', noServer: 'অনলাইনের জন্য গেম সার্ভার লাগবে (npm start)।',
  connecting: 'সংযোগ হচ্ছে…', linkCopied: 'ইনভাইট লিংক কপি হয়েছে!', timeUp: 'সময় শেষ! পালা চলে গেল।',
  equalOn: 'দুটো কলমই Lv1-এ খেলবে।', equalOff: 'প্রতিটা কলম নিজের লেভেলে খেলবে।', firstHint: 'তোমার কলম ধরো, পেছনে টানো আর ছেড়ে দাও!',
  rematchWait: '{name}-এর জন্য অপেক্ষা…', rematchAsk: '{name} আবার খেলতে চায়!', autoNextIn: '{n} সেকেন্ডে পরের ম্যাচ', enterCode: '৫ অক্ষরের কোড দাও',
  time: 'সময়', shots: 'শট', score: 'স্কোর', level: 'লেভেল', selfOut: 'নিজের শটেই পড়ে গেছে',
  timePlayed: 'মোট খেলার সময়', avgMatch: 'গড় ম্যাচ', fastestWin: 'দ্রুততম জয়', longestMatch: 'দীর্ঘতম ম্যাচ',
  byLevel: 'লেভেল অনুযায়ী', averageMatch: 'গড় ম্যাচ', countingFromNow: 'এখন থেকে গোনা হবে', savedDevice: 'শুধু এই ডিভাইসে সেভ',
  played: 'খেলা', won: 'জয়', lost: 'হার', draws: 'ড্র', winRate: 'জয়ের হার', bestStreak: 'সেরা টানা জয়', streakNow: 'এখনকার টানা জয়',
  playedWonRate: 'খেলা · জয় · হার', bestPerPen: 'কলম অনুযায়ী', playedWins: 'খেলা · জয়', notPlayed: 'এখনো খেলা হয়নি',
  pw: '{p} বার খেলা · {w} জয়', noMatches: 'এখনো কোনো ম্যাচ নেই', noMatchesSub: 'শেষ হওয়া ম্যাচগুলো এখানে দেখাবে।',
  players: 'খেলোয়াড়', matches: 'ম্যাচ', visits: 'ভিজিট', hoursPlayed: 'মোট খেলার ঘণ্টা', timeOnSite: 'সাইটে সময়', onlineNowL: 'এখন অনলাইনে',
  vscWorld: 'বিশ্বজুড়ে কম্পিউটারের সাথে', playersWon: 'খেলোয়াড় জিতেছে', computerWon: 'কম্পিউটার জিতেছে', wld: 'জয় · হার · ড্র',
  updatedEvery: 'গেম সার্ভার থেকে লাইভ আপডেট', worldOffline: 'বিশ্ব পরিসংখ্যানের জন্য গেম সার্ভার লাগবে।', topPlayers: 'সেরা অনলাইন খেলোয়াড়',
  yourOnline: 'তোমার অনলাইন রেকর্ড', noOnline: 'এখনো অনলাইন ম্যাচ নেই। তুমিই প্রথম হও!', wl: '{w} জয় · {l} হার',
  power: 'শক্তি', weight: 'ওজন', roll: 'গড়ানো', length: 'দৈর্ঘ্য', winsOnPen: 'এই কলমে জয়', nextLevel: 'Lv{l}-এর জন্য আরো {n} জয়', maxLevel: 'সর্বোচ্চ লেভেল!',
  backupTitle: 'ব্যাকআপ নাও', backupSub: 'কোডটা কপি করে রেখে দাও। যেকোনো ডিভাইসে "ফিরিয়ে আনো"-তে পেস্ট করো।',
  restoreTitle: 'অগ্রগতি ফিরিয়ে আনো', restoreSub: 'ব্যাকআপ কোড পেস্ট করো।', restoreOk: 'অগ্রগতি ফিরে এসেছে!', restoreBad: 'কোডটা কাজ করেনি।',
  resetConfirm: 'এই ডিভাইসের সব পরিসংখ্যান আর কলমের লেভেল মুছে দেবে?', resetDone: 'অগ্রগতি মুছে দেওয়া হয়েছে।', copy: 'কপি', copied: 'কপি হয়েছে!',
  min: '{n} মিনিট', sec: '{n} সে', ago: '{t} আগে', justNow: 'এইমাত্র', vsComputerChip: 'কম্পিউটার', twoChip: '২ জন', onlineChip: 'অনলাইন',
  turnTimer: 'পালার সময়', tutorialAgain: 'প্র্যাকটিস ম্যাচ খেলো', tutorialSub: 'সহজ কম্পিউটারের সাথে একটা ম্যাচ।', back: 'ফিরে যাও',
  serverHint: 'অনলাইন · সার্ভার লাগবে',
  help: [
    ['লক্ষ্য', 'goal', ['ওদের কলম বেঞ্চ থেকে ফেলে দাও। নিজেরটা রাখো।', 'কলমের মাঝখান বেঞ্চের বাইরে গেলেই সেটা পড়ে যায়।']],
    ['কীভাবে মারবে', 'flick', ['তোমার কলম ধরো, পেছনে টানো আর ছেড়ে দাও। কলম উল্টো দিকে ছুটবে।', 'যত বেশি টানবে তত জোর। স্ক্রিনের কিনারায় ধরে রাখলে জোর বাড়তেই থাকে। খুব অল্প টানলে বাতিল হয়।', 'মাথার কাছে ধরলে ঘুরবে। মাঝখানে ধরলে সোজা যাবে।', 'পাশ থেকে মারলে অনেক দূর গড়ায়। লম্বালম্বি ধাক্কা অনেক দুর্বল।']],
    ['পালা', null, ['খেলোয়াড়রা পালা করে খেলে। প্রতি পালায় একটা শট।', 'অনলাইনে প্রতি পালায় ৩০ সেকেন্ড সময়। শেষ হলে পালা চলে যায়।']],
    ['জয়', null, ['ওদের কলম ফেললে রাউন্ড তোমার। নিজের কলম পড়লে রাউন্ড ওদের।', 'দুটোই পড়লে রাউন্ড আবার হবে।', 'নির্দিষ্ট সংখ্যক রাউন্ড জিতলেই ম্যাচ জয়।']],
    ['বেঞ্চ ছোট হয়', 'shrink', ['এক রাউন্ডে ৬টা শটের পর প্রতি ২ শটে বেঞ্চ ছোট হয়।', 'লাল ড্যাশ লাইন পরের কিনারা দেখায়। এর বাইরে থাকা কলম পড়ে যাবে।']],
    ['কলম', null, ['প্রতিটা কলম আলাদা: লম্বা কলম দূরে গড়ায়, মোটা কলম ভারী, হালকা কলম দ্রুত ছোটে।', 'কলমের কার্ডে i চাপলে শক্তি, ওজন আর গড়ানো দেখা যায়।']],
    ['লেভেল আর অগ্রগতি', null, ['একটা কলম দিয়ে কম্পিউটারের সাথে প্রতি ৩ জয়ে লেভেল বাড়ে (Lv5 পর্যন্ত)।', 'প্রতি লেভেলে একটু শক্তি আর ওজন বাড়ে।']],
    ['ক্লাসিক আর রিয়েল লুক', null, ['ক্লাসিক কার্টুন কলম, রিয়েল চকচকে বাস্তব কলম। শুধু দেখতে আলাদা।']],
    ['সমান লেভেল আর মিরর ম্যাচ', null, ['সমান লেভেল: দুটো কলমই Lv1-এ, শুধু দক্ষতা গোনা হবে।', 'মিরর ম্যাচ: কম্পিউটার তোমার মতো একই কলম নেবে।']],
    ['কম্পিউটারের লেভেল', null, ['সহজ অনেক ভুল করে। মাঝারি সমান লড়াই। কঠিন প্রতিটা শট হিসাব করে মারে।']],
    ['২ জন খেলোয়াড়', null, ['একটা ডিভাইসে পালা করে খেলো। প্রত্যেকে নিজের কলম বেছে নাও।']],
    ['অনলাইন', null, ['কুইক ম্যাচ অপেক্ষারত যে কারো সাথে মিলিয়ে দেয়।', 'রুম বানালে বন্ধুর জন্য কোড আর লিংক পাবে। অনলাইনে কলম সবসময় সমান লেভেলে।']],
    ['টিপস', null, ['কলমের আড়াআড়ি মারো, লম্বালম্বি না।', 'ওদের কলমের মাথায় মারলে ঘুরে যায়।', 'নরম শট যেটা বেঞ্চে থাকে, সেটা বড় শটের চেয়ে ভালো যেটা উড়ে যায়।', 'কিনারা থেকে দূরে থাকো, বিশেষ করে রাউন্ডের শেষে।', 'সেটিংসে নিশানা গাইড দেখায় কলম কোথায় যাবে।'], true],
  ],
};

const DICT = { en, bn };
let lang = 'en';

export function setLang(l) {
  lang = DICT[l] ? l : 'en';
  document.documentElement.lang = lang;
}
export function getLang() { return lang; }

export function t(key, vars) {
  let s = (DICT[lang] && DICT[lang][key]) ?? en[key] ?? key;
  if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
}

export function num(n) {
  if (lang !== 'bn') return String(n);
  return String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
}
