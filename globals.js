import { Vector2 } from "./vector2.js";

export const gravity = new Vector2(0, 9.81);
export const circleDragCoefficient = 0.47
// export const airDensity = 1.225 <--- modified by the slider instead
export const dragK = 1 / 20000; // arbitrary coefficient for drag to keep air density be 1.225
export const gK = 200; // arbitrary coefficient for gravity to keep it 9.81
export const fK = 0.2; // friction coefficient

export const colors = [
    "red", "pink", "orange", "blue", "green", "aqua", "brown", "yellow",
    "purple", "fuchsia", "darkslateblue", "coral", "chartreuse", "aquamarine",
    "gold", "firebrick", "dodgerblue", "darkviolet", "forestgreen", "chocolate",
    "darkseagreen", "darkorchid", "cornflowerblue", "darkgreen", "darkgoldenrod",
    "tomato", "mediumspringgreen", "orchid", "crimson"
];


export const REST_THRESHOLD = 10;