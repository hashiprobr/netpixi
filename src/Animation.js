import { gsap } from 'gsap';


export default function () {
    const tweens = [];

    function initialize(frames) {
        tweens.splice(0, tweens.length, ...frames);
    }

    function insert(frame) {
        tweens.push(frame);
    }

    return { tweens, initialize, insert };
}
