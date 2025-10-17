import { ArrowLeft, MoreVertical, Instagram, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const navigate = useNavigate();

  const mockVideos = [
    { id: 1, thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop" },
    { id: 2, thumbnail: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=400&fit=crop" },
    { id: 3, thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=400&fit=crop" },
    { id: 4, thumbnail: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&h=400&fit=crop" },
    { id: 5, thumbnail: "https://images.unsplash.com/photo-1484589065579-248aad0d8b13?w=400&h=400&fit=crop" },
    { id: 6, thumbnail: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=400&h=400&fit=crop" },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header with cinematic gradient */}
      <div className="relative h-64" style={{ background: 'var(--gradient-aelixto)' }}>
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

      {/* Stats overlapping profile picture */}
      <div className="relative px-4">
        {/* Left stat - Followers */}
        <div className="absolute left-4 top-16 bg-background rounded-2xl px-5 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.15)] border-2 border-foreground">
          <div className="text-2xl font-bold">7058</div>
          <div className="text-xs font-bold">Followers</div>
        </div>
        
        {/* Right stat - Following */}
        <div className="absolute right-4 top-16 bg-background rounded-2xl px-5 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.15)] border-2 border-foreground">
          <div className="text-2xl font-bold">85</div>
          <div className="text-xs font-bold">Following</div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="mt-28 px-6 text-center">
        {/* Aelix Score */}
        <div className="mt-4 mx-auto inline-block px-12 py-3 border-3 border-foreground rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
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

        {/* Social Links */}
        <div className="flex items-center justify-center gap-6 mt-6">
          <Button variant="outline" size="icon" className="h-14 w-14 rounded-2xl border-2 border-muted-foreground/40 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
            <Instagram className="h-7 w-7 stroke-[1.5]" />
          </Button>
          <Button variant="outline" size="icon" className="h-14 w-14 rounded-2xl border-2 border-muted-foreground/40 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
            <Youtube className="h-7 w-7 stroke-[1.5]" />
          </Button>
          <Button variant="outline" size="icon" className="h-14 w-14 rounded-2xl border-2 border-muted-foreground/40 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </Button>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/30 mt-8 mb-6"></div>

        {/* Video Grid */}
        <div className="grid grid-cols-2 gap-2 mt-6 max-w-md mx-auto">
          {mockVideos.map((video) => (
            <div 
              key={video.id} 
              className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-muted shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
            >
              <img 
                src={video.thumbnail} 
                alt="Video thumbnail"
                className="w-full h-full object-cover"
              />
              {/* Platform logo overlay */}
              <div className="absolute top-2 right-2 h-6 w-6 bg-white/90 rounded-md flex items-center justify-center shadow-sm">
                <Youtube className="h-4 w-4 text-black opacity-70" />
              </div>
              {/* Play button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-md shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center">
                  <div className="w-0 h-0 border-l-[14px] border-l-white border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent ml-1"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Profile;
