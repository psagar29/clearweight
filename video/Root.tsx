import { Composition } from "remotion";
import { ClearweightDemo } from "./Demo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ClearweightDemo"
      component={ClearweightDemo}
      durationInFrames={360}
      fps={30}
      width={1280}
      height={720}
    />
  );
};
