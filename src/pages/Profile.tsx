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
      {/* Header with gradient */}
      <div className="relative h-56" style={{ background: 'var(--gradient-sunset)' }}>
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-12 w-12 bg-black/20 hover:bg-black/30 text-white rounded-full"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-7 w-7" />
          </Button>
          <div className="text-white text-left flex-1 ml-3">
            <h2 className="text-xl font-bold">Andrew Rollings</h2>
            <p className="text-sm">@andrewwr10</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-12 w-12 bg-black/20 hover:bg-black/30 text-white rounded-full"
          >
            <MoreVertical className="h-7 w-7" />
          </Button>
        </div>
        
        {/* Profile picture overlapping gradient and white section */}
        <div className="absolute -bottom-20 left-1/2 transform -translate-x-1/2 z-10">
          <div className="h-40 w-40 rounded-full bg-background p-1">
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
      <div className="relative px-6">
        {/* Left stat - Followers */}
        <div className="absolute left-6 top-12 bg-background rounded-3xl px-6 py-3 shadow-lg border border-border">
          <div className="text-2xl font-bold">7058</div>
          <div className="text-xs font-semibold">Followers</div>
        </div>
        
        {/* Right stat - Following */}
        <div className="absolute right-6 top-12 bg-background rounded-3xl px-6 py-3 shadow-lg border border-border">
          <div className="text-2xl font-bold">85</div>
          <div className="text-xs font-semibold">Following</div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="mt-24 px-6 text-center">
        {/* Aelix Score */}
        <div className="mt-4 mx-auto inline-block px-10 py-2 border-2 border-foreground rounded-3xl">
          <div className="text-3xl font-bold">45,700</div>
          <div className="text-xs font-bold tracking-wider">AELIX SCORE</div>
        </div>

        {/* Bio */}
        <p className="mt-5 text-base italic">
          "Chasing multiple dreams, within a single life"
        </p>

        {/* Follow Button */}
        <Button className="mt-5 w-full max-w-xs rounded-full h-14 text-lg font-bold bg-foreground text-background hover:bg-foreground/90">
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
        <div className="flex items-center justify-center gap-8 mt-6">
          <Button variant="outline" size="icon" className="h-16 w-16 rounded-xl border-2 border-muted-foreground/30">
            <Instagram className="h-8 w-8 stroke-[1.5]" />
          </Button>
          <Button variant="outline" size="icon" className="h-16 w-16 rounded-xl border-2 border-muted-foreground/30">
            <Youtube className="h-8 w-8 stroke-[1.5]" />
          </Button>
          <Button variant="outline" size="icon" className="h-16 w-16 rounded-xl border-2 border-muted-foreground/30">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </Button>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-2 gap-2.5 mt-8 max-w-md mx-auto">
          {mockVideos.map((video) => (
            <div 
              key={video.id} 
              className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-muted"
            >
              <img 
                src={video.thumbnail} 
                alt="Video thumbnail"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                  <div className="w-0 h-0 border-l-[16px] border-l-white border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1"></div>
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
