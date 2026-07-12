import mascotAsset from "~/assets/mascot.png";
import cheeringSprite from "~/assets/sprites/cheering.png";
import runningSprite from "~/assets/sprites/running.png";
import sittingSprite from "~/assets/sprites/sitting.png";
import standingSprite from "~/assets/sprites/standing.png";
import walkingSprite from "~/assets/sprites/walking.png";

export const mascotUrl = mascotAsset;

export const mascotSpriteUrls = [
  cheeringSprite,
  walkingSprite,
  runningSprite,
  sittingSprite,
  standingSprite,
] as const;
