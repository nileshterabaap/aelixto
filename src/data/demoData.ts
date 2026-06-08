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
  media_url?: string | null;
  thumbnailUrl?: string;
  thumbnail_url?: string | null;
  preview_image_url?: string | null;
  preview_title?: string | null;
  preview_text?: string | null;
  media_kind?: string | null;
  aspect_ratio?: number | null;
  suggested_height?: number | null;
  platform?: 'youtube' | 'tiktok' | 'instagram' | 'reddit' | 'twitter' | 'pinterest' | 'facebook' | 'spotify' | 'quora' | 'medium';
  embed_html?: string | null;
  timestamp: Date;
  saves: number;
  likes_count?: number;
  comments_count?: number;
}

export const demoPosts: Post[] = [
  {
    id: '1',
    author: { name: 'Jake Thompson', username: 'jakethompson', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop' },
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
    author: { name: 'Emily Rose', username: 'emilyrose', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop' },
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
    author: { name: 'Sarah Miller', username: 'sarahmiller', avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200&h=200&fit=crop' },
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
    author: { name: 'Alex Chen', username: 'u/techproductivity', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop' },
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
    author: { name: 'Marcus Johnson', username: 'marcusj', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop' },
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
    author: { name: 'David Park', username: 'davidpark', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop' },
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
    author: { name: 'Jessica Lee', username: 'jessicalee', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop' },
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
    author: { name: 'Ryan Martinez', username: 'u/pcmasterrace', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop' },
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
    author: { name: 'Olivia Brown', username: 'oliviabrown', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop' },
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
    author: { name: 'Tyler Wilson', username: 'tylerwilson', avatar: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=200&h=200&fit=crop' },
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
    author: { name: 'Mia Anderson', username: 'miaanderson', avatar: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&h=200&fit=crop' },
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
    author: { name: 'Chris Taylor', username: 'u/foodporn', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&h=200&fit=crop' },
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
    author: { name: 'Sophie Davis', username: 'sophiedavis', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&fit=crop' },
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
    author: { name: 'Michael Garcia', username: 'michaelgarcia', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop' },
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
    author: { name: 'Nathan Brooks', username: 'nathanbrooks', avatar: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=200&h=200&fit=crop' },
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
    author: { name: 'Emma White', username: 'u/travel', avatar: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=200&h=200&fit=crop' },
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
    author: { name: 'Ethan Clark', username: 'ethanclark', avatar: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=200&h=200&fit=crop' },
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
    author: { name: 'Daniel Rodriguez', username: 'danielrodriguez', avatar: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=200&h=200&fit=crop' },
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
    author: { name: 'Kevin Zhang', username: 'kevinzhang', avatar: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=200&h=200&fit=crop' },
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
    author: { name: 'Rachel Kim', username: 'rachelkim', avatar: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=200&h=200&fit=crop' },
    title: '',
    content: 'The James Webb Space Telescope captured this 🌌',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&h=800',
    platform: 'instagram',
    timestamp: new Date(Date.now() - 1000 * 60 * 540),
    saves: 8901
  },
  {
    id: '21',
    author: { name: 'Lisa Chen', username: 'lisachen', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop' },
    title: 'Modern Minimalist Living Room',
    content: 'Clean lines and natural light ✨ #interiordesign #minimalist',
    mediaType: 'none',
    mediaUrl: 'https://pin.it/2r57xj7Vi',
    platform: 'pinterest',
    timestamp: new Date(Date.now() - 1000 * 60 * 570),
    saves: 1234
  },
  {
    id: '22',
    author: { name: 'Anna Martinez', username: 'annamartinez', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop' },
    title: 'Delicious Chocolate Cake Recipe',
    content: 'Perfect for any occasion! 🍰',
    mediaType: 'none',
    mediaUrl: 'https://pin.it/6isLuHgMI',
    platform: 'pinterest',
    timestamp: new Date(Date.now() - 1000 * 60 * 600),
    saves: 892
  },
  {
    id: '23',
    author: { name: 'James Wilson', username: 'jameswilson', avatar: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=200&h=200&fit=crop' },
    title: 'Amazing sunset at the beach',
    content: 'Beautiful evening! 🌅',
    mediaType: 'none',
    platform: 'facebook',
    embed_html: '<div class="fb-post" data-href="https://www.facebook.com/FacebookDevelopers/posts/10151471074398553" data-width="500" data-show-text="true"></div>',
    timestamp: new Date(Date.now() - 1000 * 60 * 630),
    saves: 567
  },
  {
    id: '24',
    author: { name: 'Sarah Johnson', username: 'sarahjohnson', avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200&h=200&fit=crop' },
    title: 'The Psychology Behind Procrastination',
    content: 'An insightful look into why we delay important tasks',
    mediaType: 'none',
    mediaUrl: 'https://www.reddit.com/r/science/comments/1g3sjl5/new_study_finds_that_people_who_procrastinate/',
    thumbnailUrl: 'https://images.unsplash.com/photo-1516534775068-ba3e7458af70?w=800&h=450&fit=crop',
    platform: 'reddit',
    timestamp: new Date(Date.now() - 1000 * 60 * 660),
    saves: 432
  },
  {
    id: '25',
    author: { name: 'Alex Thompson', username: 'alexthompson', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop' },
    title: 'How to Build a Successful Remote Team',
    content: 'Essential strategies for managing distributed teams effectively',
    mediaType: 'none',
    mediaUrl: 'https://medium.com/swlh/how-to-build-a-successful-remote-team-in-2024-b8e3c9c1f2a4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=450&fit=crop',
    platform: 'medium',
    timestamp: new Date(Date.now() - 1000 * 60 * 690),
    saves: 678
  },
  {
    id: '26',
    author: { name: 'Michael Chen', username: 'michaelchen', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop' },
    title: 'What are the best practices for learning to code?',
    content: 'A comprehensive guide to starting your programming journey',
    mediaType: 'none',
    mediaUrl: 'https://www.quora.com/What-are-the-best-programming-languages-to-learn-in-2024',
    thumbnailUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=450&fit=crop',
    platform: 'quora',
    timestamp: new Date(Date.now() - 1000 * 60 * 720),
    saves: 891
  }
];
