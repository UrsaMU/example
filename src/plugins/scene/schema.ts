export interface IScene {
  id: string;          // room dbobj id (u.here.id)
  title: string;       // optional short label for this scene
  description: string; // narrative scene-setting text
  setBy: string;       // staff player id
  setByName: string;
  setAt: number;
}
