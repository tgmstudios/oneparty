// Catalogue of Hue-style presets shipped by the Home Assistant `scene_presets` integration (Hypfer/hass-scene_presets).
// Source: custom_components/scene_presets/assets/Readme.md. Subset relevant to parties; any raw UUID also works as a preset id.
const T = `
Halloween|Trick or treat|8a363ceb-f4c2-4c7f-9cd3-a71a6181b471
Halloween|Glowing grins|938da1ed-edbc-4cf0-b9ab-bdc3d7d0659f
Halloween|Spellbound|0d2a6c4f-9c71-4279-950c-05f3f84b6dbd
Halloween|Hocus pocus|00b65abf-df21-4f15-a379-c1742fb786fb
Halloween|Toil and trouble|074338f3-f7f3-4402-9f30-46ac70e5a0e6
Halloween|Witching hour|2ad04284-2f0a-40d9-b2a9-6b929a475fa1
Halloween|Pandemonium|0cbcc8ed-5474-471c-b3c1-45b4acc555b1
Halloween|Phantom|d824598f-0c09-4e67-beb2-972a8d5813e2
Party vibes|Miami|a592fa63-4ba6-4399-a120-1c0b79ac832d
Party vibes|Cancun|c321d848-51a8-4d09-9ad0-5e6b44bc7f2c
Party vibes|Rio|94fc428e-2855-4f67-877e-3d1e1dd95b7d
Party vibes|Chinatown|7581da02-1688-4128-9bb9-b635f3b89999
Party vibes|Ibiza|eaa0d424-ac66-4247-8342-06d2b128ac31
Party vibes|Osaka|5768805d-27c1-442e-b069-d20443485201
Party vibes|Tokyo|de7eda64-84bf-4ed6-a4fa-76e0ebdd1968
Party vibes|Motown|7dded6f8-a2aa-4726-b391-21e9a0f76eee
Party vibes|Fairfax|abfc5768-5c2c-4d61-bd03-2b64660e813f
Futuristic|Soho|3580a7b2-ef38-4f34-bb5b-6416dde9df81
Futuristic|Vapor wave|3984c3b7-6608-482f-84be-d2ffe39dbb1a
Futuristic|Magneto|7fd8b7d2-7dd3-46b3-8188-23e34841eb98
Futuristic|Tyrell|66893c7e-4535-46d4-b9c7-fb6f5a80faa9
Futuristic|Disturbia|1a379a13-fd93-4f1d-977d-f0816b4385a4
Futuristic|Hal|78bbd5e7-720c-4343-9655-19602852e630
Serenity|Galaxy|a6ba3a6e-1e3a-41fd-84f2-f7b021935deb
Serenity|Starlight|a2f95aab-e80a-4aca-ae32-142cdc7ad3e0
Serenity|Blood moon|8d0f34db-78fd-475d-9bed-a502b787964d
Serenity|Arctic aurora|940fd864-51e1-4761-95d3-75d4d68835ea
Serenity|Moonlight|a87a8467-82ff-43f8-aaf3-6649b57b1480
Serenity|Nebula|3c8662e5-e650-4f6a-a4b2-03b66d502f77
Rustic|Amber robin|ae6319a6-7c4f-4f85-87b9-ade7dc8e2c26
Rustic|Woodland toadstool|ad0fe6ac-5877-4dc7-8386-6d4e8a17ea88
Rustic|Pumpkin spice|b592ea26-5c52-403d-9836-82140fc2b679
Rustic|Fall harvest|a2fc579f-71e5-47a1-af9d-43e8edd91c6e
Rustic|Pumpkin patch|1ae2c539-9afa-4870-bb29-061c255f2177
Luxurious|Emerald flutter|95048fa7-6283-4253-9ca8-ad090b33f3e7
Luxurious|Memento|c3058e2f-695d-445c-b859-b6567c856e4e
Luxurious|Resplendent|ce4a5344-e052-43da-904a-123d7c024bf3
Luxurious|Scarlet dream|51960d8b-e47a-4b04-9163-28e3bbc91601
Vibrant|Juicy watermelon|eebd67ce-5b73-4cb6-b926-bf4613c361b0
Vibrant|Summer splash|fd02c728-e90e-4abd-b1bf-6b2f2acb0b11
Vibrant|Fruity popsicle|77cf9ffd-5491-47cd-83d6-2f0e806b4cb0
Sports|Stadium|f587060a-c4a1-4885-87ff-54c247fb29e6
Palettes|SECAM|dbffbd71-7f65-428a-9ac7-0db51057d31a
Palettes|CGA|9565033d-f2ea-4821-bfba-7dd9b35be20a
Palettes|Light Cycles|97648e18-758a-4382-99a4-8b657f4bb098
Palettes|Valetudo|4bc4f958-b4af-46cf-8e67-636161e714f5
Presets|Bright|84ebc26c-9d61-4d25-830c-41ea66f1c325
Presets|Energize|0eeacfc5-2d81-4035-a23d-4a9bc02af965
Presets|Dimmed|8f55e62a-e5f8-456a-9e8b-61f314bd4e99
`;

export const PRESETS = T.trim().split('\n').map(l => { const [category, name, id] = l.split('|'); return { category, name, id }; });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** name (case-insensitive) or raw UUID -> preset id, or null */
export function resolvePreset(v) {
  if (!v) return null;
  if (UUID.test(v)) return v.toLowerCase();
  return PRESETS.find(p => p.name.toLowerCase() === String(v).toLowerCase())?.id || null;
}
export const presetName = id => PRESETS.find(p => p.id === id)?.name || id;
