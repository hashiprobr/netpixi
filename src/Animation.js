import { gsap } from 'gsap';


export default function () {
    const frames = [];

    function initialize(overFrames) {
        frames.splice(0, frames.length, ...overFrames);
    }

    function insert(overFrame) {
        frames.add(overFrame);
    }

    return { frames, initialize, insert };
}
