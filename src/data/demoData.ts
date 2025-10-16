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
    author: { name: 'Alex Rivera', username: 'alex_r', avatar: '🎨' },
    title: 'Portfolio Launch',
    content: 'Just launched my new portfolio! What do you think?',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    saves: 42
  },
  {
    id: '2',
    author: { name: 'Sarah Chen', username: 'sarahc', avatar: '🌸' },
    title: 'Morning Routine',
    content: 'Morning routine tips that actually changed my life 🌅',
    mediaType: 'none',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    saves: 128
  },
  {
    id: '3',
    author: { name: 'Marcus Johnson', username: 'marcusj', avatar: '🎬' },
    title: 'Behind the Scenes',
    content: 'Behind the scenes of today\'s shoot. The lighting was perfect!',
    mediaType: 'video',
    mediaUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    saves: 89
  },
  {
    id: '4',
    author: { name: 'Emma Watson', username: 'emmaw', avatar: '📚' },
    title: 'Book Recommendation',
    content: 'Currently reading "Atomic Habits" and it\'s mind-blowing. Highly recommend!',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800',
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    saves: 234
  },
  {
    id: '5',
    author: { name: 'David Kim', username: 'davidk', avatar: '💻' },
    title: 'New Setup',
    content: 'New coding setup complete! Clean desk = clean code 🖥️',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800',
    timestamp: new Date(Date.now() - 1000 * 60 * 90),
    saves: 67
  },
  {
    id: '6',
    author: { name: 'Lisa Park', username: 'lisap', avatar: '🍜' },
    title: 'Homemade Ramen',
    content: 'Homemade ramen recipe that\'s easier than you think!',
    mediaType: 'video',
    mediaUrl: 'https://www.youtube.com/watch?v=example2',
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
    saves: 156
  },
  {
    id: '7',
    author: { name: 'James Miller', username: 'jamesm', avatar: '🏃' },
    title: 'First Marathon',
    content: 'Finished my first marathon today! 42km in 4 hours. Never giving up on dreams! 💪',
    mediaType: 'none',
    timestamp: new Date(Date.now() - 1000 * 60 * 150),
    saves: 312
  },
  {
    id: '8',
    author: { name: 'Nina Patel', username: 'ninap', avatar: '🎵' },
    title: 'New Track',
    content: 'Working on a new track. Here\'s a snippet 🎧',
    mediaType: 'video',
    mediaUrl: 'https://www.youtube.com/watch?v=example3',
    timestamp: new Date(Date.now() - 1000 * 60 * 180),
    saves: 98
  },
  {
    id: '9',
    author: { name: 'Ryan Lee', username: 'ryanl', avatar: '🏔️' },
    title: 'Mountain Sunrise',
    content: 'Sunrise from the peak. The climb was worth it.',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    timestamp: new Date(Date.now() - 1000 * 60 * 210),
    saves: 445
  },
  {
    id: '10',
    author: { name: 'Sophie Zhang', username: 'sophiez', avatar: '🎭' },
    title: 'Opening Night',
    content: 'Theater life. Opening night nerves but so excited! 🎪',
    mediaType: 'none',
    timestamp: new Date(Date.now() - 1000 * 60 * 240),
    saves: 76
  },
  {
    id: '11',
    author: { name: 'Tom Anderson', username: 'toma', avatar: '📷' },
    title: 'Photography Tips',
    content: 'Golden hour photography tips for beginners',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800',
    timestamp: new Date(Date.now() - 1000 * 60 * 270),
    saves: 189
  },
  {
    id: '12',
    author: { name: 'Maya Torres', username: 'mayat', avatar: '🌿' },
    title: 'Indoor Garden',
    content: 'My indoor garden is thriving! 🪴 Tips in comments',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1463320726281-696a485928c7?w=800',
    timestamp: new Date(Date.now() - 1000 * 60 * 300),
    saves: 203
  },
  {
    id: '13',
    author: { name: 'Chris Brown', username: 'chrisb', avatar: '⚽' },
    title: 'Match Day',
    content: 'Match day! Let\'s do this team 🔥',
    mediaType: 'none',
    timestamp: new Date(Date.now() - 1000 * 60 * 330),
    saves: 54
  },
  {
    id: '14',
    author: { name: 'Ana Silva', username: 'anas', avatar: '✈️' },
    title: 'Bali Travel Vlog',
    content: 'Travel vlog from Bali is live! Link in bio',
    mediaType: 'video',
    mediaUrl: 'https://www.youtube.com/watch?v=example4',
    timestamp: new Date(Date.now() - 1000 * 60 * 360),
    saves: 567
  },
  {
    id: '15',
    author: { name: 'Kevin Wu', username: 'kevinw', avatar: '🎮' },
    title: 'Boss Battle Victory',
    content: 'Finally beat that boss after 50 tries! Gaming perseverance pays off 🎯',
    mediaType: 'none',
    timestamp: new Date(Date.now() - 1000 * 60 * 390),
    saves: 112
  },
  {
    id: '16',
    author: { name: 'Rachel Green', username: 'rachelg', avatar: '☕' },
    title: 'Coffee Art',
    content: 'Coffee art progress! Still learning but getting better',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800',
    timestamp: new Date(Date.now() - 1000 * 60 * 420),
    saves: 91
  },
  {
    id: '17',
    author: { name: 'Mike Thompson', username: 'miket', avatar: '🎸' },
    title: 'New Song Release',
    content: 'New song release tomorrow! Preview coming soon 🎶',
    mediaType: 'none',
    timestamp: new Date(Date.now() - 1000 * 60 * 450),
    saves: 287
  },
  {
    id: '18',
    author: { name: 'Zara Ali', username: 'zaraa', avatar: '🎨' },
    title: 'Digital Art Commission',
    content: 'Digital art commission finished! So happy with how this turned out',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800',
    timestamp: new Date(Date.now() - 1000 * 60 * 480),
    saves: 378
  },
  {
    id: '19',
    author: { name: 'Lucas Martin', username: 'lucasm', avatar: '🚴' },
    title: 'Bike Training',
    content: '100km bike ride complete! Training for the big race',
    mediaType: 'none',
    timestamp: new Date(Date.now() - 1000 * 60 * 510),
    saves: 145
  },
  {
    id: '20',
    author: { name: 'Olivia Baker', username: 'oliviab', avatar: '🍰' },
    title: 'Baking Therapy',
    content: 'Baking therapy: chocolate cake edition 🍫',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800',
    timestamp: new Date(Date.now() - 1000 * 60 * 540),
    saves: 223
  }
];
