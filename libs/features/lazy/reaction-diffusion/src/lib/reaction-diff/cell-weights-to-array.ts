export interface CellWeights {
  topLeft: number;
  topCenter: number;
  topRight: number;
  left: number;
  center: number;
  right: number;
  bottomLeft: number;
  bottomCenter: number;
  bottomRight: number;
}

type NineTuple = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
export const weightsToArray: (weights: CellWeights) => NineTuple = (
  weights: CellWeights
) => {
  const {
    bottomLeft,
    left,
    bottomCenter,
    topCenter,
    right,
    topRight,
    center,
    bottomRight,
    topLeft,
  } = weights;
  return [
    topLeft,
    topCenter,
    topRight,
    left,
    center,
    right,
    bottomLeft,
    bottomCenter,
    bottomRight,
  ];
};
