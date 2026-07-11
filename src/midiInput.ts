/** Web MIDI input: device discovery + note-on events from the user's keyboard. */
export class MidiInput {
  private access: MIDIAccess | null = null;
  private selected: MIDIInput | null = null;

  onNoteOn: ((midi: number, velocity: number) => void) | null = null;
  onDevicesChanged: (() => void) | null = null;

  get supported(): boolean {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  async init(): Promise<boolean> {
    if (!this.supported) return false;
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
    } catch {
      return false;
    }
    this.access.onstatechange = () => this.onDevicesChanged?.();
    return true;
  }

  listInputs(): Array<{ id: string; name: string }> {
    if (!this.access) return [];
    return [...this.access.inputs.values()].map((i) => ({
      id: i.id,
      name: i.name || `Input ${i.id}`,
    }));
  }

  get selectedId(): string {
    return this.selected?.id ?? '';
  }

  select(id: string): void {
    if (this.selected) this.selected.onmidimessage = null;
    this.selected = null;
    if (!this.access || !id) return;
    const input = [...this.access.inputs.values()].find((i) => i.id === id) ?? null;
    this.selected = input;
    if (input) {
      input.onmidimessage = (e: MIDIMessageEvent) => {
        const data = e.data;
        if (!data || data.length < 3) return;
        const status = data[0] & 0xf0;
        if (status === 0x90 && data[2] > 0) {
          this.onNoteOn?.(data[1], data[2] / 127);
        }
      };
    }
  }
}
