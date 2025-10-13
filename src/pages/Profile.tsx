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
      <div className="relative h-52" style={{ background: 'var(--gradient-sunset)' }}>
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 pt-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 bg-foreground/20 hover:bg-foreground/30 text-background rounded-full"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="text-background text-left flex-1 ml-2">
            <h2 className="text-[19px] font-bold leading-tight">Andrew Rollings</h2>
            <p className="text-[13px] leading-tight">@andrewwr10</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 bg-foreground/20 hover:bg-foreground/30 text-background rounded-full"
          >
            <MoreVertical className="h-6 w-6" />
          </Button>
        </div>
        
        {/* Profile picture overlapping gradient and white section */}
        <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 z-10">
          <div className="h-32 w-32 rounded-full bg-background p-[3px]">
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

      {/* Profile Info */}
      <div className="mt-20 px-5 text-center">
        {/* Stats side by side */}
        <div className="flex items-center justify-center gap-16 mb-4">
          <div>
            <div className="text-[28px] font-bold leading-tight">7058</div>
            <div className="text-[13px] font-medium leading-tight">Followers</div>
          </div>
          <div>
            <div className="text-[28px] font-bold leading-tight">85</div>
            <div className="text-[13px] font-medium leading-tight">Following</div>
          </div>
        </div>

        {/* Aelix Score */}
        <div className="mt-3 mx-auto inline-block px-10 py-2.5 border-[2.5px] border-foreground rounded-full">
          <div className="text-[26px] font-bold leading-tight">45,700</div>
          <div className="text-[11px] font-bold tracking-[0.15em] mt-0.5 leading-tight">AELIX SCORE</div>
        </div>

        {/* Bio */}
        <p className="mt-4 text-[15px] italic leading-snug">
          "Chasing multiple dreams, within a single life"
        </p>

        {/* Follow Button */}
        <Button className="mt-4 w-full max-w-[260px] rounded-full h-11 text-[15px] font-semibold bg-foreground text-background hover:bg-foreground/90">
          Follow
        </Button>

        {/* Menu Icon */}
        <div className="mt-5 flex justify-center">
          <div className="flex flex-col gap-1">
            <div className="h-[3px] w-8 bg-foreground rounded-full"></div>
            <div className="h-[3px] w-8 bg-foreground rounded-full"></div>
            <div className="h-[3px] w-8 bg-foreground rounded-full"></div>
          </div>
        </div>

        {/* Social Links */}
        <div className="flex items-center justify-center gap-8 mt-5">
          <Button variant="outline" size="icon" className="h-[52px] w-[52px] rounded-[14px] border-[2.5px] border-foreground">
            <Instagram className="h-6 w-6 stroke-[2]" />
          </Button>
          <Button variant="outline" size="icon" className="h-[52px] w-[52px] rounded-[14px] border-[2.5px] border-foreground">
            <Youtube className="h-6 w-6 stroke-[2]" />
          </Button>
          <Button variant="outline" size="icon" className="h-[52px] w-[52px] rounded-[14px] border-[2.5px] border-foreground">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </Button>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-2 gap-2.5 mt-6 max-w-md mx-auto pb-4">
          {mockVideos.map((video) => (
            <div 
              key={video.id} 
              className="relative aspect-[3/4] rounded-[18px] overflow-hidden bg-muted"
            >
              <img 
                src={video.thumbnail} 
                alt="Video thumbnail"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-foreground/25 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="w-0 h-0 border-l-[12px] border-l-background border-t-[9px] border-t-transparent border-b-[9px] border-b-transparent ml-0.5"></div>
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
