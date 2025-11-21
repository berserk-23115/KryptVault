import React from "react";

interface FolderProps {
  color?: string;
  size?: number;
  className?: string;
  isOpen?: boolean;
}

const darkenColor = (hex: string, percent: number): string => {
  let color = hex.startsWith("#") ? hex.slice(1) : hex;
  if (color.length === 3) {
    color = color.split("").map((c) => c + c).join("");
  }

  const num = parseInt(color, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;

  r = Math.floor(r * (1 - percent));
  g = Math.floor(g * (1 - percent));
  b = Math.floor(b * (1 - percent));

  return (
    "#" +
    ((1 << 24) + (r << 16) + (g << 8) + b)
      .toString(16)
      .slice(1)
      .toUpperCase()
  );
};

const Folder: React.FC<FolderProps> = ({
  color = "#5227FF",
  size = 1,
  className = "",
  isOpen = false,
}) => {
  const folderBackColor = darkenColor(color, 0.08);

  const scaleStyle = { transform: `scale(${size})` };

  return (
    <div style={scaleStyle} className={className}>
      <div
        className={`group relative transition-all duration-200 ease-in ${
          !isOpen ? "hover:-translate-y-2" : ""
        }`}
        style={{
          transform: isOpen ? "translateY(-8px)" : undefined,
        }}
      >
        {/* FOLDER BODY — SMALLER */}
        <div
          className="relative w-[85px] h-[60px] rounded-tl-0 rounded-tr-[10px] rounded-br-[10px] rounded-bl-[10px]"
          style={{ backgroundColor: folderBackColor }}
        >
          {/* Folder tab (scaled down) */}
          <span
            className="absolute z-0 bottom-[98%] left-0 w-[36px] h-[9px] rounded-tl-[5px] rounded-tr-[5px]"
            style={{ backgroundColor: folderBackColor }}
          ></span>

          {/* Papers (scaled + repositioned) */}
          <div
            className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-[78%] h-[58%] bg-white rounded-md"
            style={{ zIndex: 10, opacity: 0.6 }}
          />
          <div
            className="absolute bottom-[14%] left-1/2 -translate-x-1/2 w-[73%] h-[53%] bg-white rounded-md"
            style={{ zIndex: 9, opacity: 0.5 }}
          />
          <div
            className="absolute bottom-[18%] left-1/2 -translate-x-1/2 w-[68%] h-[48%] bg-white rounded-md"
            style={{ zIndex: 8, opacity: 0.4 }}
          />

          {/* Folder flap — left */}
          <div
            className={`absolute z-0 w-full h-full origin-bottom transition-all duration-300 ease-in-out ${
              !isOpen ? "group-hover:[transform:skew(15deg)_scaleY(0.6)]" : ""
            }`}
            style={{
              backgroundColor: color,
              borderRadius: "5px 10px 10px 10px",
              ...(isOpen && { transform: "skew(15deg) scaleY(0.6)" }),
            }}
          ></div>

          {/* Folder flap — right */}
          <div
            className={`absolute z-30 w-full h-full origin-bottom transition-all duration-300 ease-in-out ${
              !isOpen ? "group-hover:[transform:skew(-15deg)_scaleY(0.6)]" : ""
            }`}
            style={{
              backgroundColor: color,
              borderRadius: "5px 10px 10px 10px",
              ...(isOpen && { transform: "skew(-15deg) scaleY(0.6)" }),
            }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default Folder;
