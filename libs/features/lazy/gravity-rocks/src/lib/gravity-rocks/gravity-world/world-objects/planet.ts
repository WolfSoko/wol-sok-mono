import { uuidToColor } from '@wolsok/utils-math';
import { WorldObject } from './world-object';

export class Planet extends WorldObject {
  color = uuidToColor(this.id);
}
