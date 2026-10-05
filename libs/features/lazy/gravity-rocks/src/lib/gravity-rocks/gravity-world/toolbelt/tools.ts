/** What a press on the world does - picked from the toolbelt. */
export type Tool = 'grab' | 'select' | 'add' | 'orbit' | 'delete';

/** What the add tool puts down on empty space. */
export type ObjectKind = 'asteroid' | 'planet' | 'giant' | 'star';

export const TOOLS: readonly {
  id: Tool;
  icon: string;
  label: string;
  hint: string;
}[] = [
  {
    id: 'grab',
    icon: 'pan_tool',
    label: 'Grab',
    hint: 'Grab: drag a body to fling it, tap it to follow it',
  },
  {
    id: 'select',
    icon: 'ads_click',
    label: 'Select',
    hint: 'Select: tap a body to open its settings',
  },
  {
    id: 'add',
    icon: 'add_circle',
    label: 'Add',
    hint: 'Add: tap empty space to put a body there, drag to fling it',
  },
  {
    id: 'orbit',
    icon: 'track_changes',
    label: 'Put in orbit',
    hint: 'Put in orbit: tap a body, then press beside it and drag the orbit - let go to add the satellite',
  },
  {
    id: 'delete',
    icon: 'delete',
    label: 'Delete',
    hint: 'Delete: tap a body to take it out of the world',
  },
];

export const OBJECT_KINDS: readonly {
  id: ObjectKind;
  icon: string;
  label: string;
}[] = [
  { id: 'asteroid', icon: 'grain', label: 'Asteroid' },
  { id: 'planet', icon: 'public', label: 'Planet' },
  { id: 'giant', icon: 'lens', label: 'Gas giant' },
  { id: 'star', icon: 'star', label: 'Star' },
];
