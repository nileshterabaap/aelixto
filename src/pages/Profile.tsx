import { ArrowLeft, MoreVertical, Instagram, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import profileHeaderNature from "@/assets/profile-header-nature.jpg";

const Profile = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("youtube");

  const youtubeVideos = [
    { id: 1, thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop", platform: "youtube" },
    { id: 2, thumbnail: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=400&fit=crop", platform: "youtube" },
    { id: 3, thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=400&fit=crop", platform: "youtube" },
    { id: 4, thumbnail: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&h=400&fit=crop", platform: "youtube" },
    { id: 5, thumbnail: "https://images.unsplash.com/photo-1484589065579-248aad0d8b13?w=400&h=400&fit=crop", platform: "youtube" },
    { id: 6, thumbnail: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=400&h=400&fit=crop", platform: "youtube" },
    { id: 7, thumbnail: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=400&fit=crop", platform: "youtube" },
    { id: 8, thumbnail: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=400&fit=crop", platform: "youtube" },
    { id: 9, thumbnail: "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=400&h=400&fit=crop", platform: "youtube" },
  ];

  const instagramPosts = [
    { id: 1, thumbnail: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=400&h=400&fit=crop", platform: "instagram" },
    { id: 2, thumbnail: "https://images.unsplash.com/photo-1682687221038-404cb8830901?w=400&h=400&fit=crop", platform: "instagram" },
    { id: 3, thumbnail: "https://images.unsplash.com/photo-1682695796954-bad0d0f59ff1?w=400&h=400&fit=crop", platform: "instagram" },
    { id: 4, thumbnail: "https://images.unsplash.com/photo-1682687220063-4742bd7fd538?w=400&h=400&fit=crop", platform: "instagram" },
    { id: 5, thumbnail: "https://images.unsplash.com/photo-1682695798256-28a674122872?w=400&h=400&fit=crop", platform: "instagram" },
    { id: 6, thumbnail: "https://images.unsplash.com/photo-1682695797221-8164ff1fafc9?w=400&h=400&fit=crop", platform: "instagram" },
    { id: 7, thumbnail: "https://images.unsplash.com/photo-1682695796497-31a44224d6d6?w=400&h=400&fit=crop", platform: "instagram" },
    { id: 8, thumbnail: "https://images.unsplash.com/photo-1682695797873-aa4cb6edd613?w=400&h=400&fit=crop", platform: "instagram" },
    { id: 9, thumbnail: "https://images.unsplash.com/photo-1682687982501-1e58ab814714?w=400&h=400&fit=crop", platform: "instagram" },
  ];

  const xPosts = [
    { id: 1, username: "Sarah Chen", handle: "@sarahchen", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop", text: "The upcoming election will reshape global trade policies. Markets are already pricing in potential tariff changes. History shows economic policy shifts have long-term ripple effects 📊🌍", likes: 892, retweets: 234 },
    { id: 2, username: "Dr. Marcus Kim", handle: "@drmarcusk", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop", text: "Breakthrough in quantum computing: researchers achieved 1000+ qubit stability at room temperature. This could revolutionize cryptography and drug discovery within the decade 🔬⚛️", likes: 1243, retweets: 456 },
    { id: 3, username: "Elena Rodriguez", handle: "@elenarodz", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop", text: "Federal Reserve's decision to maintain rates signals confidence in soft landing. Inflation trending down while employment remains strong. Textbook monetary policy execution 📈💼", likes: 678, retweets: 189 },
    { id: 4, username: "James Wilson", handle: "@jwilson_pol", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop", text: "The geopolitical shift in the Indo-Pacific is accelerating. New alliances forming as nations reassess their strategic partnerships. This will define the next decade of international relations 🌏🤝", likes: 1567, retweets: 423 },
    { id: 5, username: "Dr. Aisha Patel", handle: "@aishapatel_sci", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop", text: "CRISPR gene therapy shows 95% success rate in latest trials for sickle cell disease. We're witnessing the beginning of personalized medicine becoming mainstream healthcare 🧬💉", likes: 2134, retweets: 678 },
    { id: 6, username: "Michael Torres", handle: "@mtorres_econ", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop", text: "China's economic pivot toward domestic consumption is reshaping global supply chains. Western manufacturers need to adapt or risk losing competitive advantage. The decoupling is real 📦🌐", likes: 956, retweets: 312 },
    { id: 7, username: "Prof. Lisa Zhang", handle: "@profzhang", avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200&h=200&fit=crop", text: "AI models now surpassing human performance in protein folding predictions. The implications for drug development and disease treatment are staggering. Science fiction becoming reality 🤖🔬", likes: 1789, retweets: 534 },
    { id: 8, username: "David Kumar", handle: "@dkumar_geo", avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop", text: "Arctic shipping routes opening earlier each year. This isn't just climate change - it's a complete reconfiguration of global trade geography and territorial claims. Watch this space 🚢❄️", likes: 1423, retweets: 389 },
    { id: 9, username: "Emma Foster", handle: "@emmaf_policy", avatar: "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=200&h=200&fit=crop", text: "Universal basic income pilot programs showing unexpected results: increased entrepreneurship and education enrollment, minimal impact on workforce participation. Data challenging assumptions 💰📊", likes: 2891, retweets: 756 },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header with aerial nature scene */}
      <div className="relative h-64 overflow-hidden">
        <img 
          src={profileHeaderNature} 
          alt="Morning nature landscape"
          className="w-full h-full object-cover"
        />
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 bg-[hsl(var(--brand-orange))] hover:bg-[hsl(var(--brand-orange))]/90 text-black rounded-full shadow-md"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="text-black text-left flex-1 ml-2">
            <h2 className="text-xl font-bold">Andrew Rollings</h2>
            <p className="text-sm font-medium">@andrewwr10</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 bg-transparent hover:bg-black/10 text-black rounded-full"
          >
            <MoreVertical className="h-6 w-6" />
          </Button>
        </div>
        
        {/* Profile picture overlapping gradient */}
        <div className="absolute -bottom-24 left-1/2 transform -translate-x-1/2 z-10">
          <div className="h-48 w-48 rounded-full bg-background p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.15)]">
            <div className="h-full w-full rounded-full overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop" 
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats and Profile Info */}
      <div className="mt-20 px-6 text-center relative">
        <div className="absolute -top-6 left-0 right-0 h-6 bg-background rounded-t-[32px]"></div>
        <div className="relative pt-8">
          {/* Stats Row */}
          <div className="flex justify-between items-start mb-8 px-4">
            {/* Left stat - Followers */}
            <div className="text-left">
              <div className="text-2xl font-bold">7058</div>
              <div className="text-xs font-bold">Followers</div>
            </div>
            
            {/* Right stat - Following */}
            <div className="text-right">
              <div className="text-2xl font-bold">85</div>
              <div className="text-xs font-bold">Following</div>
            </div>
          </div>

          {/* Aelix Score */}
          <div className="mx-auto inline-block px-12 py-3 border-2 border-foreground rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.2)] bg-background">
          <div className="text-3xl font-bold">45,700</div>
          <div className="text-xs font-bold tracking-widest">AELIX SCORE</div>
        </div>

        {/* Bio */}
        <p className="mt-6 text-base italic font-medium">
          "Chasing multiple dreams, within a single life"
        </p>

        {/* Follow Button */}
        <Button className="mt-6 w-full max-w-sm rounded-full h-14 text-lg font-bold bg-foreground text-background hover:bg-foreground/90 shadow-[0_6px_16px_rgba(0,0,0,0.2)]">
          Follow
        </Button>

        {/* Menu Icon */}
        <div className="mt-8 flex justify-start px-2">
          <div className="flex flex-col gap-1.5">
            <div className="h-1 w-8 bg-foreground rounded-full"></div>
            <div className="h-1 w-8 bg-foreground rounded-full"></div>
            <div className="h-1 w-8 bg-foreground rounded-full"></div>
          </div>
        </div>

        {/* Platform Tabs */}
        <Tabs defaultValue="youtube" className="w-full mt-6" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-transparent gap-3 h-auto p-0">
            <TabsTrigger 
              value="youtube" 
              className="data-[state=active]:bg-black data-[state=active]:text-white rounded-full h-12 border-2 border-muted-foreground/40"
            >
              <Youtube className="h-5 w-5" />
            </TabsTrigger>
            <TabsTrigger 
              value="instagram"
              className="data-[state=active]:bg-black data-[state=active]:text-white rounded-full h-12 border-2 border-muted-foreground/40"
            >
              <Instagram className="h-5 w-5" />
            </TabsTrigger>
            <TabsTrigger 
              value="x"
              className="data-[state=active]:bg-black data-[state=active]:text-white rounded-full h-12 border-2 border-muted-foreground/40"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="youtube">
            <div className="grid grid-cols-3 gap-2 mt-6 max-w-lg mx-auto">
              {youtubeVideos.map((video) => (
                <div 
                  key={video.id} 
                  className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-muted shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
                >
                  <img 
                    src={video.thumbnail} 
                    alt="Video thumbnail"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 h-6 w-6 bg-black rounded-md flex items-center justify-center shadow-sm">
                    <Youtube className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-md shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center">
                      <div className="w-0 h-0 border-l-[12px] border-l-white border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent ml-1"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="instagram">
            <div className="grid grid-cols-3 gap-2 mt-6 max-w-lg mx-auto">
              {instagramPosts.map((post) => (
                <div 
                  key={post.id} 
                  className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-muted shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
                >
                  <img 
                    src={post.thumbnail} 
                    alt="Instagram post"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 h-6 w-6 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-md flex items-center justify-center shadow-sm">
                    <Instagram className="h-3.5 w-3.5 text-white" />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="x">
            <div className="grid grid-cols-1 gap-3 mt-6 max-w-lg mx-auto">
              {xPosts.map((post) => (
                <div 
                  key={post.id} 
                  className="relative rounded-2xl overflow-hidden bg-card border border-border shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex-shrink-0 overflow-hidden">
                      <img 
                        src={post.avatar} 
                        alt={post.username}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{post.username}</span>
                        <span className="text-muted-foreground text-sm">{post.handle}</span>
                      </div>
                    </div>
                    <svg className="h-4 w-4 text-foreground flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed mb-3">
                    {post.text}
                  </p>
                  <div className="flex items-center gap-6 text-muted-foreground text-xs">
                    <div className="flex items-center gap-1">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      <span>{post.likes}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 1l4 4-4 4"/>
                        <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                        <path d="M7 23l-4-4 4-4"/>
                        <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                      </svg>
                      <span>{post.retweets}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Profile;
