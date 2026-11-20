import { AcBrand, AcCodeSet, AcState } from './acIr';

export interface RoomProfile {
  id: string;
  name: string;
  deviceId: string | null;
  tvBrand: string;
  tvCodeSet: AcCodeSet;
  acBrand: AcBrand;
  acCodeSet: AcCodeSet;
  acState: AcState;
}
