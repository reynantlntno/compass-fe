import Image from "next/image";

import { cn } from "@/lib/utils";

const characters = {
  "point-up": {
    src: "/images/compass/gco-character-point-up.png",
    width: 330,
    height: 330,
  },
  "point-right": {
    src: "/images/compass/gco-character-point-right.png",
    width: 338,
    height: 330,
  },
  wave: {
    src: "/images/compass/gco-character-wave.png",
    width: 330,
    height: 330,
  },
} as const;

export type HomepageCharacterName = keyof typeof characters;

export function HomepageCharacter({
  character,
  className,
  sizes = "(max-width: 40rem) 7rem, 10rem",
}: {
  character: HomepageCharacterName;
  className?: string;
  sizes?: string;
}) {
  const asset = characters[character];

  return (
    <span aria-hidden="true" className={cn("homepage-character", className)}>
      <Image
        alt=""
        aria-hidden="true"
        className="homepage-character__image"
        height={asset.height}
        sizes={sizes}
        src={asset.src}
        width={asset.width}
      />
    </span>
  );
}
