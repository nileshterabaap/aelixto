export interface Post {
  id: string;
  author: {
    name: string;
    username: string;
    avatar: string;
  };
  title: string;
  content: string;
  mediaType?: 'image' | 'video' | 'none';
  mediaUrl?: string;
  timestamp: Date;
  saves: number;
}

export const demoPosts: Post[] = [
  {
    id: '1',
    author: { name: 'MrBeast', username: 'mrbeast', avatar: '🎬' },
    title: 'I Built 100 Wells In Africa',
    content: 'This changed everything. Watch till the end 🌍',
    mediaType: 'video',
    mediaUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    saves: 1250
  },
  {
    id: '2',
    author: { name: 'Bella Poarch', username: 'bellapoarch', avatar: '🎵' },
    title: '',
    content: '#fyp #viral #dance 💃✨',
    mediaType: 'video',
    mediaUrl: 'https://www.tiktok.com/@bellapoarch/video/1234567890',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    saves: 892
  },
  {
    id: '3',
    author: { name: 'Selena Gomez', username: 'selenagomez', avatar: '⭐' },
    title: '',
    content: 'Golden hour ✨',
    mediaType: 'image',
    mediaUrl: 'https://www.instagram.com/p/CxYz123456',
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    saves: 2340
  },
  {
    id: '4',
    author: { name: 'Tech Tips', username: 'u/techproductivity', avatar: '💻' },
    title: 'My productivity setup after 5 years of refinement',
    content: 'Finally achieved my dream desk setup. Monitor: LG 38" ultrawide, Keyboard: Custom mechanical...',
    mediaType: 'image',
    mediaUrl: 'https://www.reddit.com/r/battlestations/comments/example',
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    saves: 456
  },
  {
    id: '5',
    author: { name: 'Khaby Lame', username: 'khaby.lame', avatar: '😂' },
    title: '',
    content: 'why make it complicated? 🤷‍♂️ #comedy #lifehacks',
    mediaType: 'video',
    mediaUrl: 'https://www.tiktok.com/@khaby.lame/video/9876543210',
    timestamp: new Date(Date.now() - 1000 * 60 * 90),
    saves: 1567
  },
  {
    id: '6',
    author: { name: 'MKBHD', username: 'mkbhd', avatar: '📱' },
    title: 'iPhone 15 Pro Review: The Titanium Difference!',
    content: 'Is the new titanium design worth it? Full review is here!',
    mediaType: 'video',
    mediaUrl: 'https://www.youtube.com/watch?v=example123',
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
    saves: 987
  },
  {
    id: '7',
    author: { name: 'Kylie Jenner', username: 'kyliejenner', avatar: '💄' },
    title: '',
    content: 'new Kylie Cosmetics drop tomorrow 💋',
    mediaType: 'image',
    mediaUrl: 'https://www.instagram.com/p/DaB987654',
    timestamp: new Date(Date.now() - 1000 * 60 * 150),
    saves: 3120
  },
  {
    id: '8',
    author: { name: 'Gaming Pro', username: 'u/pcmasterrace', avatar: '🎮' },
    title: 'Just finished my first custom water-cooled build',
    content: 'After 6 months of planning and saving, my dream PC is finally complete. Specs in comments!',
    mediaType: 'image',
    mediaUrl: 'https://www.reddit.com/r/pcmasterrace/comments/build',
    timestamp: new Date(Date.now() - 1000 * 60 * 180),
    saves: 234
  },
  {
    id: '9',
    author: { name: 'Charli D\'Amelio', username: 'charlidamelio', avatar: '💃' },
    title: '',
    content: 'learned this in 10 mins lol #dancechallenge #foryou',
    mediaType: 'video',
    mediaUrl: 'https://www.tiktok.com/@charlidamelio/video/5555555555',
    timestamp: new Date(Date.now() - 1000 * 60 * 210),
    saves: 2890
  },
  {
    id: '10',
    author: { name: 'Dude Perfect', username: 'dudeperfect', avatar: '🏀' },
    title: 'Impossible Trick Shots 2024',
    content: 'Our craziest shots yet! Which one was your favorite? 🎯',
    mediaType: 'video',
    mediaUrl: 'https://www.youtube.com/watch?v=trickshots2024',
    timestamp: new Date(Date.now() - 1000 * 60 * 240),
    saves: 1456
  },
  {
    id: '11',
    author: { name: 'Ariana Grande', username: 'arianagrande', avatar: '🎤' },
    title: '',
    content: 'thank u, next 🤍',
    mediaType: 'image',
    mediaUrl: 'https://www.instagram.com/p/Fgh456789',
    timestamp: new Date(Date.now() - 1000 * 60 * 270),
    saves: 4120
  },
  {
    id: '12',
    author: { name: 'Food Lover', username: 'u/foodporn', avatar: '🍜' },
    title: '[Homemade] Tonkotsu Ramen with chashu pork',
    content: 'Spent 18 hours on the broth. Totally worth it!',
    mediaType: 'image',
    mediaUrl: 'https://www.reddit.com/r/food/comments/ramen',
    timestamp: new Date(Date.now() - 1000 * 60 * 300),
    saves: 678
  },
  {
    id: '13',
    author: { name: 'Addison Rae', username: 'addisonrae', avatar: '✨' },
    title: '',
    content: 'obsessed with this sound 🎶 #trending',
    mediaType: 'video',
    mediaUrl: 'https://www.tiktok.com/@addisonrae/video/7777777777',
    timestamp: new Date(Date.now() - 1000 * 60 * 330),
    saves: 1789
  },
  {
    id: '14',
    author: { name: 'Cristiano Ronaldo', username: 'cristiano', avatar: '⚽' },
    title: '',
    content: 'Training hard 💪🔥 #CR7',
    mediaType: 'image',
    mediaUrl: 'https://www.instagram.com/p/Jkl234567',
    timestamp: new Date(Date.now() - 1000 * 60 * 360),
    saves: 5670
  },
  {
    id: '15',
    author: { name: 'Veritasium', username: 'veritasium', avatar: '🔬' },
    title: 'The Real Reason SpaceX Landed Starship',
    content: 'This engineering feat is more impressive than you think. Here\'s why:',
    mediaType: 'video',
    mediaUrl: 'https://www.youtube.com/watch?v=spacex2024',
    timestamp: new Date(Date.now() - 1000 * 60 * 390),
    saves: 2340
  },
  {
    id: '16',
    author: { name: 'Travel Guru', username: 'u/travel', avatar: '✈️' },
    title: 'Santorini sunset - no filter needed',
    content: 'This view never gets old. Best time to visit is September!',
    mediaType: 'image',
    mediaUrl: 'https://www.reddit.com/r/travel/comments/santorini',
    timestamp: new Date(Date.now() - 1000 * 60 * 420),
    saves: 891
  },
  {
    id: '17',
    author: { name: 'Zach King', username: 'zachking', avatar: '🎩' },
    title: '',
    content: 'wait for it... 🪄✨ #magic #satisfying',
    mediaType: 'video',
    mediaUrl: 'https://www.tiktok.com/@zachking/video/8888888888',
    timestamp: new Date(Date.now() - 1000 * 60 * 450),
    saves: 3456
  },
  {
    id: '18',
    author: { name: 'Dwayne Johnson', username: 'therock', avatar: '💪' },
    title: '',
    content: 'It\'s about drive, it\'s about power 🔥',
    mediaType: 'image',
    mediaUrl: 'https://www.instagram.com/p/Mno890123',
    timestamp: new Date(Date.now() - 1000 * 60 * 480),
    saves: 6789
  },
  {
    id: '19',
    author: { name: 'Linus Tech Tips', username: 'linustechtips', avatar: '🖥️' },
    title: 'I Bought a $20,000 Gaming PC',
    content: 'Is it actually 10x better? Let\'s find out with some benchmarks!',
    mediaType: 'video',
    mediaUrl: 'https://www.youtube.com/watch?v=gamingpc2024',
    timestamp: new Date(Date.now() - 1000 * 60 * 510),
    saves: 1234
  },
  {
    id: '20',
    author: { name: 'NASA', username: 'nasa', avatar: '🚀' },
    title: '',
    content: 'The James Webb Space Telescope captured this 🌌',
    mediaType: 'image',
    mediaUrl: 'https://www.instagram.com/p/Pqr567890',
    timestamp: new Date(Date.now() - 1000 * 60 * 540),
    saves: 8901
  }
];
