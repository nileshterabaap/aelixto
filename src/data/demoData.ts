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
  platform?: 'youtube' | 'tiktok' | 'instagram' | 'reddit';
  timestamp: Date;
  saves: number;
}

export const demoPosts: Post[] = [
  {
    id: '1',
    author: { name: 'Jake Thompson', username: 'jakethompson', avatar: '🎬' },
    title: 'I Built 100 Wells In Africa',
    content: 'This changed everything. Watch till the end 🌍',
    mediaType: 'video',
    mediaUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&h=450',
    platform: 'youtube',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    saves: 1250
  },
  {
    id: '2',
    author: { name: 'Emily Rose', username: 'emilyrose', avatar: '🎵' },
    title: '',
    content: '#fyp #viral #dance 💃✨',
    mediaType: 'video',
    mediaUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=710',
    platform: 'tiktok',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    saves: 892
  },
  {
    id: '3',
    author: { name: 'Sarah Miller', username: 'sarahmiller', avatar: '⭐' },
    title: '',
    content: 'Golden hour ✨',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&h=800',
    platform: 'instagram',
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    saves: 2340
  },
  {
    id: '4',
    author: { name: 'Alex Chen', username: 'u/techproductivity', avatar: '💻' },
    title: 'My productivity setup after 5 years of refinement',
    content: 'Finally achieved my dream desk setup. Monitor: LG 38" ultrawide, Keyboard: Custom mechanical...',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800&h=450',
    platform: 'reddit',
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    saves: 456
  },
  {
    id: '5',
    author: { name: 'Marcus Johnson', username: 'marcusj', avatar: '😂' },
    title: '',
    content: 'why make it complicated? 🤷‍♂️ #comedy #lifehacks',
    mediaType: 'video',
    mediaUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=710',
    platform: 'tiktok',
    timestamp: new Date(Date.now() - 1000 * 60 * 90),
    saves: 1567
  },
  {
    id: '6',
    author: { name: 'David Park', username: 'davidpark', avatar: '📱' },
    title: 'iPhone 15 Pro Review: The Titanium Difference!',
    content: 'Is the new titanium design worth it? Full review is here!',
    mediaType: 'video',
    mediaUrl: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=800&h=450',
    platform: 'youtube',
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
    saves: 987
  },
  {
    id: '7',
    author: { name: 'Jessica Lee', username: 'jessicalee', avatar: '💄' },
    title: '',
    content: 'new makeup collection drop tomorrow 💋',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1586297135537-94bc9ba060aa?w=800&h=800',
    platform: 'instagram',
    timestamp: new Date(Date.now() - 1000 * 60 * 150),
    saves: 3120
  },
  {
    id: '8',
    author: { name: 'Ryan Martinez', username: 'u/pcmasterrace', avatar: '🎮' },
    title: 'Just finished my first custom water-cooled build',
    content: 'After 6 months of planning and saving, my dream PC is finally complete. Specs in comments!',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&h=450',
    platform: 'reddit',
    timestamp: new Date(Date.now() - 1000 * 60 * 180),
    saves: 234
  },
  {
    id: '9',
    author: { name: 'Olivia Brown', username: 'oliviabrown', avatar: '💃' },
    title: '',
    content: 'learned this in 10 mins lol #dancechallenge #foryou',
    mediaType: 'video',
    mediaUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=710',
    platform: 'tiktok',
    timestamp: new Date(Date.now() - 1000 * 60 * 210),
    saves: 2890
  },
  {
    id: '10',
    author: { name: 'Tyler Wilson', username: 'tylerwilson', avatar: '🏀' },
    title: 'Impossible Trick Shots 2024',
    content: 'Our craziest shots yet! Which one was your favorite? 🎯',
    mediaType: 'video',
    mediaUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&h=450',
    platform: 'youtube',
    timestamp: new Date(Date.now() - 1000 * 60 * 240),
    saves: 1456
  },
  {
    id: '11',
    author: { name: 'Mia Anderson', username: 'miaanderson', avatar: '🎤' },
    title: '',
    content: 'thank u, next 🤍',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&h=800',
    platform: 'instagram',
    timestamp: new Date(Date.now() - 1000 * 60 * 270),
    saves: 4120
  },
  {
    id: '12',
    author: { name: 'Chris Taylor', username: 'u/foodporn', avatar: '🍜' },
    title: '[Homemade] Tonkotsu Ramen with chashu pork',
    content: 'Spent 18 hours on the broth. Totally worth it!',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&h=450',
    platform: 'reddit',
    timestamp: new Date(Date.now() - 1000 * 60 * 300),
    saves: 678
  },
  {
    id: '13',
    author: { name: 'Sophie Davis', username: 'sophiedavis', avatar: '✨' },
    title: '',
    content: 'obsessed with this sound 🎶 #trending',
    mediaType: 'video',
    mediaUrl: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=710',
    platform: 'tiktok',
    timestamp: new Date(Date.now() - 1000 * 60 * 330),
    saves: 1789
  },
  {
    id: '14',
    author: { name: 'Michael Garcia', username: 'michaelgarcia', avatar: '⚽' },
    title: '',
    content: 'Training hard 💪🔥 #fitness',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&h=800',
    platform: 'instagram',
    timestamp: new Date(Date.now() - 1000 * 60 * 360),
    saves: 5670
  },
  {
    id: '15',
    author: { name: 'Nathan Brooks', username: 'nathanbrooks', avatar: '🔬' },
    title: 'The Real Reason SpaceX Landed Starship',
    content: 'This engineering feat is more impressive than you think. Here\'s why:',
    mediaType: 'video',
    mediaUrl: 'https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=800&h=450',
    platform: 'youtube',
    timestamp: new Date(Date.now() - 1000 * 60 * 390),
    saves: 2340
  },
  {
    id: '16',
    author: { name: 'Emma White', username: 'u/travel', avatar: '✈️' },
    title: 'Santorini sunset - no filter needed',
    content: 'This view never gets old. Best time to visit is September!',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800&h=450',
    platform: 'reddit',
    timestamp: new Date(Date.now() - 1000 * 60 * 420),
    saves: 891
  },
  {
    id: '17',
    author: { name: 'Ethan Clark', username: 'ethanclark', avatar: '🎩' },
    title: '',
    content: 'wait for it... 🪄✨ #magic #satisfying',
    mediaType: 'video',
    mediaUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=710',
    platform: 'tiktok',
    timestamp: new Date(Date.now() - 1000 * 60 * 450),
    saves: 3456
  },
  {
    id: '18',
    author: { name: 'Daniel Rodriguez', username: 'danielrodriguez', avatar: '💪' },
    title: '',
    content: 'It\'s about drive, it\'s about power 🔥',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1583468982228-19f19164aee2?w=800&h=800',
    platform: 'instagram',
    timestamp: new Date(Date.now() - 1000 * 60 * 480),
    saves: 6789
  },
  {
    id: '19',
    author: { name: 'Kevin Zhang', username: 'kevinzhang', avatar: '🖥️' },
    title: 'I Bought a $20,000 Gaming PC',
    content: 'Is it actually 10x better? Let\'s find out with some benchmarks!',
    mediaType: 'video',
    mediaUrl: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=800&h=450',
    platform: 'youtube',
    timestamp: new Date(Date.now() - 1000 * 60 * 510),
    saves: 1234
  },
  {
    id: '20',
    author: { name: 'Rachel Kim', username: 'rachelkim', avatar: '🚀' },
    title: '',
    content: 'The James Webb Space Telescope captured this 🌌',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&h=800',
    platform: 'instagram',
    timestamp: new Date(Date.now() - 1000 * 60 * 540),
    saves: 8901
  }
];
