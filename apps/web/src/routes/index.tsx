'use client';

import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import SplashCursor from "@/components/SplashCursor";
import LaserFlow from "@/components/LaserFlow";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <div className="relative min-h-screen w-full bg-[#050311] text-white overflow-hidden">

      {/* ---------- GLOBAL FLUID BACKGROUND ---------- */}
      <SplashCursor
        DENSITY_DISSIPATION={8}
        COLOR_UPDATE_SPEED={8}
        SPLAT_FORCE={9000}
        BACK_COLOR={{ r: 0, g: 0, b: 0 }}
      />

      {/* ---------- HERO SECTION ---------- */}
      <div className="relative flex flex-col items-center justify-center pt-0 pb-0 select-none">

        {/* LASERFLOW SPOTLIGHT */}
        {/* <div className="w-full md:h-[500px] overflow-hidden pointer-events-none opacity-95">
          <LaserFlow
            className="w-full h-full mix-blend-screen"
            flowSpeed={0.35}
            fogIntensity={0.45}
            color="#E879F9"
            verticalSizing={1.3}
            horizontalSizing={0.7}
          />
        </div> */}

        {/* FLOATING TITLE */}
        <div className="z-0 text-center mt-[350px]">
          <h1
            className="
              text-6xl md:text-8xl font-extrabold tracking-tight
              bg-gradient-to-r from-purple-200 via-fuchsia-200 to-sky-200
              bg-clip-text text-transparent
              drop-shadow-[0_0_40px_rgba(236,72,153,0.5)]
              animate-[glow_5s_ease-in-out_infinite]
            "
          >
            KRYPTVAULT
          </h1>

          <p className="mt-3 text-lg text-purple-300/80 tracking-wide">
            Group Name: <span className="text-purple-200">UmbrellaCorp</span>
          </p>
        </div>

        {/* SUBTEXT */}
        <p className="max-w-3xl mx-auto mt-7 text-sm md:text-base text-purple-100/60 leading-relaxed text-center">
          A zero-knowledge encrypted vault engineered for creators, teams, and
          security-critical workflows. Nothing leaves your device without being 
          encrypted. Every access path — observable, reversible, yours.
        </p>

        {/* BUTTONS */}
        <div className="relative z-10 mt-12 flex flex-wrap justify-center gap-4">
          <Link
            to="/login"
            className="
              px-20 py-6 rounded-xl text-2xl font-bold
              bg-gradient-to-r from-purple-500 to-fuchsia-500
              shadow-[0_0_35px_rgba(236,72,153,0.45)]
              hover:shadow-[0_0_55px_rgba(236,72,153,0.65)]
              transition-all duration-200 hover:scale-[1.03]
            "
          >
            Open KryptVault
          </Link>

          {/* <a
            href="#features"
            className="
              px-8 py-3 rounded-xl text-sm font-medium
              bg-white/5 border border-white/10
              backdrop-blur-xl
              hover:bg-white/10 hover:border-white/20
              transition-all duration-200
            "
          >
            Explore Features
          </a> */}
        </div>

        {/* TOP GLOW */}
        <div className="
          pointer-events-none absolute top-0 left-1/2 -translate-x-1/2
          w-[70%] h-[500px]
          bg-[radial-gradient(circle_at_top,rgba(200,70,255,0.28),transparent_75%)]
          blur-3xl opacity-70
        " />

        {/* BOTTOM GLOW */}
        <div className="
          pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2
          w-[88%] h-[600px]
          bg-[radial-gradient(circle_at_bottom,rgba(80,150,255,0.25),transparent_80%)]
          blur-3xl opacity-55
        " />
      </div>

      {/* KEYFRAME ANIMATION */}
      <style>
        {`
          @keyframes glow {
            0%   { text-shadow: 0 0 25px rgba(236,72,153,0.45), 0 0 45px rgba(168,85,247,0.22); }
            50%  { text-shadow: 0 0 40px rgba(236,72,153,0.75), 0 0 80px rgba(168,85,247,0.45); }
            100% { text-shadow: 0 0 25px rgba(236,72,153,0.45), 0 0 45px rgba(168,85,247,0.22); }
          }
        `}
      </style>
    </div>
  );
}
