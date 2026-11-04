import { ArrowDownToLine, ArrowUpToLine, Copy, Eye, EyeOff, RotateCcw, Trash2 } from 'lucide-react';
import { compileObject } from '../engine/compile';
import { spectrumWavelengths, wavelengthToCss } from '../engine/color';
import { isModified, makeMaterial, MATERIAL_ORDER, MATERIALS } from '../engine/materials';
import { abbeNumber, brewsterAngle, cauchyIndex, criticalAngle, fresnelReflectance, lensmakerFocalLength } from '../engine/optics';
import { rad2deg } from '../engine/vec';
import type {
  BodyObject,
  BodyShape,
  DetectorObject,
  EmitterType,
  Material,
  MaterialId,
  MirrorObject,
  MirrorShape,
  Polarization,
  ProtractorObject,
  RulerObject,
  SceneObject,
  SourceObject,
  Spectrum,
  ThinLensObject,
} from '../scene/types';
import { type ObjectPatch, useSelected, useStore, useTraceStore } from '../state/store';
import { FieldRow, IconButton, InfoRow, NumberInput, Section, SelectInput, SliderRow, Toggle } from './controls';

const KIND_LABEL: Record<SceneObject['kind'], string> = {
  source: 'Light Source',
  mirror: 'Mirror',
  body: 'Optical Body',
  thinlens: 'Ideal Thin Lens',
  detector: 'Detector',
  ruler: 'Ruler',
  protractor: 'Protractor',
};

type Up = (patch: ObjectPatch, key: string) => void;

export function PropertiesPanel() {
  const sel = useSelected();
  return (
    <aside className="scroll-thin h-full overflow-y-auto">
      {sel ? <ObjectPanel key={sel.id} obj={sel} /> : <ScenePanel />}
    </aside>
  );
}

function ObjectPanel({ obj }: { obj: SceneObject }) {
  const updateObject = useStore((s) => s.updateObject);
  const removeObject = useStore((s) => s.removeObject);
  const duplicateObject = useStore((s) => s.duplicateObject);
  const reorder = useStore((s) => s.reorder);
  const up: Up = (patch, key) => updateObject(obj.id, patch, { coalesce: `${obj.id}:${key}` });
  const warnings = compileObject(obj).warnings;

  return (
    <div>
      <div className="border-b border-white/[0.06] px-4 pb-3 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="brand-label text-[13px] text-coral-500">{KIND_LABEL[obj.kind]}</span>
          <div className="flex items-center">
            <IconButton title="Bring to front (Medium on top)" onClick={() => reorder(obj.id, 'front')}>
              <ArrowUpToLine className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton title="Send to back" onClick={() => reorder(obj.id, 'back')}>
              <ArrowDownToLine className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton title="Duplicate (Ctrl+D)" onClick={() => duplicateObject(obj.id)}>
              <Copy className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton title="Delete (Del)" onClick={() => removeObject(obj.id)} className="hover:!bg-red-500/15 hover:!text-red-300">
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </div>
        <input
          className="h-8 w-full rounded-md border border-white/10 bg-ink-950/70 px-2.5 text-[13px] font-medium text-slate-100 outline-none hover:border-white/20 focus:border-coral-500/70"
          value={obj.name}
          maxLength={80}
          onChange={(e) => up({ name: e.target.value }, 'name')}
        />
        {warnings.map((w) => (
          <p key={w} className="mt-2 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
            {w}
          </p>
        ))}
      </div>

      <Section title="Transform">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400">X</span>
            <NumberInput value={obj.x} onChange={(v) => up({ x: v }, 'x')} unit="mm" precision={1} min={-1e5} max={1e5} />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400">Y</span>
            <NumberInput value={obj.y} onChange={(v) => up({ y: v }, 'y')} unit="mm" precision={1} min={-1e5} max={1e5} />
          </div>
        </div>
        {obj.kind !== 'protractor' && (
          <SliderRow label={obj.kind === 'source' ? 'Direction' : 'Rotation'} value={obj.rotation} onChange={(v) => up({ rotation: v }, 'rotation')} min={-180} max={180} step={0.5} unit="°" precision={1} />
        )}
      </Section>

      {obj.kind === 'source' && <SourceProps o={obj} up={up} />}
      {obj.kind === 'mirror' && <MirrorProps o={obj} up={up} />}
      {obj.kind === 'body' && <BodyProps o={obj} up={up} />}
      {obj.kind === 'thinlens' && <ThinLensProps o={obj} up={up} />}
      {obj.kind === 'detector' && <DetectorProps o={obj} up={up} />}
      {obj.kind === 'ruler' && <RulerProps o={obj} up={up} />}
      {obj.kind === 'protractor' && <ProtractorProps o={obj} up={up} />}
    </div>
  );
}

// ───────────────────────── Sources ─────────────────────────

function SourceProps({ o, up }: { o: SourceObject; up: Up }) {
  const samples = useStore((s) => s.settings.whiteSamples);
  const wls = spectrumWavelengths(o.spectrum, o.wavelength, samples);
  return (
    <Section title="Light Source" right={<Toggle checked={o.enabled} onChange={(v) => up({ enabled: v }, 'enabled')} label={o.enabled ? 'On' : 'Off'} />}>
      <FieldRow label="Emitter">
        <SelectInput<EmitterType>
          className="w-[150px]"
          value={o.emitter}
          onChange={(v) =>
            up(
              {
                emitter: v,
                spread: v === 'point' ? 360 : v === 'fan' ? (o.spread > 0 && o.spread < 360 ? o.spread : 30) : 0,
                rayCount: v === 'point' ? Math.max(o.rayCount, 24) : o.rayCount,
              },
              'emitter',
            )
          }
          options={[
            { value: 'laser', label: 'Single-ray laser' },
            { value: 'beam', label: 'Parallel beam' },
            { value: 'point', label: 'Point source' },
            { value: 'fan', label: 'Ray fan' },
          ]}
        />
      </FieldRow>
      <FieldRow label="Spectrum">
        <SelectInput<Spectrum>
          className="w-[150px]"
          value={o.spectrum}
          onChange={(v) => up({ spectrum: v }, 'spectrum')}
          options={[
            { value: 'mono', label: 'Monochromatic' },
            { value: 'white', label: 'White light' },
            { value: 'rgb', label: 'RGB (630/532/465)' },
          ]}
        />
      </FieldRow>
      {o.spectrum === 'mono' ? (
        <>
          <SliderRow label="Wavelength" value={o.wavelength} onChange={(v) => up({ wavelength: v }, 'wavelength')} min={380} max={750} step={1} unit="nm" precision={0} accent={wavelengthToCss(o.wavelength)} />
          <div className="spectrum-bar h-1.5 rounded-full" />
        </>
      ) : (
        <div className="flex h-5 items-center gap-0.5">
          {wls.map((wl) => (
            <span key={wl} className="h-full flex-1 rounded-sm" style={{ background: wavelengthToCss(wl) }} title={`${wl.toFixed(0)} nm`} />
          ))}
        </div>
      )}
      <SliderRow label="Intensity" value={o.intensity} onChange={(v) => up({ intensity: v }, 'intensity')} min={0} max={1} step={0.01} precision={2} />
      {o.emitter !== 'laser' && (
        <SliderRow label="Ray count" value={o.rayCount} onChange={(v) => up({ rayCount: v }, 'rayCount')} min={1} max={120} hardMax={720} step={1} integer precision={0} />
      )}
      {(o.emitter === 'point' || o.emitter === 'fan') && (
        <SliderRow label="Beam spread" value={o.spread} onChange={(v) => up({ spread: v }, 'spread')} min={0} max={360} step={1} unit="°" precision={1} />
      )}
      {o.emitter === 'beam' && (
        <>
          <SliderRow label="Beam width" value={o.width} onChange={(v) => up({ width: v }, 'width')} min={2} max={400} hardMin={0.5} hardMax={5000} step={1} unit="mm" precision={1} />
          <SliderRow label="Divergence" value={o.spread} onChange={(v) => up({ spread: v }, 'spread')} min={-30} max={30} step={0.5} unit="°" precision={1} hint="Total angular spread across the beam (negative = converging)" />
        </>
      )}
      <InfoRow label="Rays traced" value={`${(o.emitter === 'laser' ? 1 : o.rayCount) * wls.length}`} />
    </Section>
  );
}

// ───────────────────────── Mirrors ─────────────────────────

function MirrorProps({ o, up }: { o: MirrorObject; up: Up }) {
  return (
    <Section title="Mirror">
      <FieldRow label="Shape">
        <SelectInput<MirrorShape>
          className="w-[150px]"
          value={o.shape}
          onChange={(v) => up({ shape: v, radius: Math.max(o.radius, o.length / 2 + 1) }, 'shape')}
          options={[
            { value: 'flat', label: 'Flat' },
            { value: 'concave', label: 'Concave (spherical)' },
            { value: 'convex', label: 'Convex (spherical)' },
            { value: 'parabolic', label: 'Parabolic' },
            { value: 'arc', label: 'Spherical segment' },
          ]}
        />
      </FieldRow>
      {o.shape !== 'arc' && (
        <SliderRow label="Aperture" value={o.length} onChange={(v) => up({ length: v }, 'length')} min={5} max={800} hardMax={1e4} step={1} unit="mm" precision={1} />
      )}
      {(o.shape === 'concave' || o.shape === 'convex' || o.shape === 'arc') && (
        <SliderRow label="Radius of curvature" value={o.radius} onChange={(v) => up({ radius: v }, 'radius')} min={o.shape === 'arc' ? 5 : Math.ceil(o.length / 2)} max={2000} hardMax={1e5} step={1} unit="mm" precision={1} />
      )}
      {o.shape === 'arc' && <SliderRow label="Arc span" value={o.arcAngle} onChange={(v) => up({ arcAngle: v }, 'arcAngle')} min={1} max={360} step={1} unit="°" precision={1} />}
      {o.shape === 'parabolic' && (
        <SliderRow label="Focal length" value={o.focalLength} onChange={(v) => up({ focalLength: v }, 'focalLength')} min={5} max={1000} hardMax={1e5} step={1} unit="mm" precision={1} />
      )}
      {(o.shape === 'concave' || o.shape === 'convex') && (
        <InfoRow label="Focal length (R/2)" value={`${o.shape === 'convex' ? '−' : ''}${(o.radius / 2).toFixed(1)} mm`} tone="text-pink-300" />
      )}
      <SliderRow label="Reflectivity" value={o.reflectivity} onChange={(v) => up({ reflectivity: v }, 'reflectivity')} min={0} max={1} step={0.01} precision={2} />
      <SliderRow label="Surface roughness" value={o.roughness} onChange={(v) => up({ roughness: v }, 'roughness')} min={0} max={1} step={0.01} precision={2} />
      <Toggle label="Two-sided" checked={o.twoSided || o.partial} onChange={(v) => up({ twoSided: v }, 'twoSided')} hint="One-sided mirrors absorb light hitting their back" />
      <Toggle label="Partially reflective (beam splitter)" checked={o.partial} onChange={(v) => up({ partial: v, twoSided: v ? true : o.twoSided }, 'partial')} />
      <InfoRow label={o.partial ? 'Transmitted' : 'Absorbed'} value={`${((1 - o.reflectivity) * 100).toFixed(1)} %`} />
    </Section>
  );
}

// ───────────────────────── Bodies ─────────────────────────

type SurfaceKind = 'convex' | 'flat' | 'concave';
const surfaceKind = (r: number): SurfaceKind => (r > 0 ? 'convex' : r < 0 ? 'concave' : 'flat');

function LensSurface({ label, r, onChange, minR }: { label: string; r: number; onChange: (v: number) => void; minR: number }) {
  const kind = surfaceKind(r);
  const mag = Math.abs(r) || 200;
  return (
    <div className="space-y-1.5 rounded-lg border border-white/[0.06] bg-white/[0.015] p-2">
      <FieldRow label={label}>
        <SelectInput<SurfaceKind>
          className="w-[110px]"
          value={kind}
          onChange={(k) => onChange(k === 'flat' ? 0 : k === 'convex' ? mag : -mag)}
          options={[
            { value: 'convex', label: 'Convex' },
            { value: 'flat', label: 'Flat' },
            { value: 'concave', label: 'Concave' },
          ]}
        />
      </FieldRow>
      {kind !== 'flat' && (
        <SliderRow label="Radius" value={mag} onChange={(v) => onChange(kind === 'convex' ? v : -v)} min={Math.ceil(minR)} max={1500} hardMin={minR} hardMax={1e5} step={1} unit="mm" precision={1} />
      )}
    </div>
  );
}

function BodyProps({ o, up }: { o: BodyObject; up: Up }) {
  const n = o.material.ior;
  let lensInfo: { f: number; label: string } | null = null;
  if (o.shape === 'lens') {
    const f = lensmakerFocalLength(cauchyIndex(n, o.material.dispersion, 589.3), o.r1, o.r2, o.thickness);
    const k1 = surfaceKind(o.r1);
    const k2 = surfaceKind(o.r2);
    const label =
      k1 === 'convex' && k2 === 'convex'
        ? 'Biconvex'
        : k1 === 'concave' && k2 === 'concave'
          ? 'Biconcave'
          : (k1 === 'flat' && k2 === 'convex') || (k1 === 'convex' && k2 === 'flat')
            ? 'Plano-convex'
            : (k1 === 'flat' && k2 === 'concave') || (k1 === 'concave' && k2 === 'flat')
              ? 'Plano-concave'
              : k1 === 'flat' && k2 === 'flat'
                ? 'Flat window'
                : 'Meniscus';
    lensInfo = { f, label };
  }
  return (
    <>
      <Section title="Geometry">
        <FieldRow label="Shape">
          <SelectInput<BodyShape>
            className="w-[150px]"
            value={o.shape}
            onChange={(v) => up({ shape: v }, 'shape')}
            options={[
              { value: 'rect', label: 'Rectangle / block' },
              { value: 'circle', label: 'Circle' },
              { value: 'prism', label: 'Prism' },
              { value: 'lens', label: 'Lens' },
              { value: 'fiber', label: 'Optical fiber' },
            ]}
          />
        </FieldRow>
        {o.shape === 'rect' && (
          <>
            <SliderRow label="Width" value={o.width} onChange={(v) => up({ width: v }, 'width')} min={2} max={1200} hardMax={1e5} step={1} unit="mm" precision={1} />
            <SliderRow label="Height" value={o.height} onChange={(v) => up({ height: v }, 'height')} min={2} max={1200} hardMax={1e5} step={1} unit="mm" precision={1} />
          </>
        )}
        {o.shape === 'circle' && <SliderRow label="Radius" value={o.radius} onChange={(v) => up({ radius: v }, 'radius')} min={2} max={600} hardMax={1e5} step={1} unit="mm" precision={1} />}
        {o.shape === 'prism' && (
          <>
            <SliderRow label="Side length" value={o.size} onChange={(v) => up({ size: v }, 'size')} min={5} max={800} hardMax={1e5} step={1} unit="mm" precision={1} />
            <SliderRow label="Apex angle" value={o.apexAngle} onChange={(v) => up({ apexAngle: v }, 'apexAngle')} min={5} max={170} step={0.5} unit="°" precision={1} />
            <InfoRow
              label="Min. deviation (589 nm)"
              value={(() => {
                const A = (o.apexAngle * Math.PI) / 180;
                const s = n * Math.sin(A / 2);
                return s < 1 ? `${rad2deg(2 * Math.asin(s) - A).toFixed(2)}°` : 'none (TIR)';
              })()}
              tone="text-pink-300"
            />
          </>
        )}
        {o.shape === 'lens' && (
          <>
            <SliderRow label="Diameter" value={o.diameter} onChange={(v) => up({ diameter: v }, 'diameter')} min={5} max={600} hardMax={1e5} step={1} unit="mm" precision={1} />
            <SliderRow label="Centre thickness" value={o.thickness} onChange={(v) => up({ thickness: v }, 'thickness')} min={0.5} max={200} hardMax={1e4} step={0.5} unit="mm" precision={1} />
            <LensSurface label="Left surface (R₁)" r={o.r1} onChange={(v) => up({ r1: v }, 'r1')} minR={o.diameter / 2 + 0.1} />
            <LensSurface label="Right surface (R₂)" r={o.r2} onChange={(v) => up({ r2: v }, 'r2')} minR={o.diameter / 2 + 0.1} />
            {lensInfo && (
              <>
                <InfoRow label="Lens type" value={lensInfo.label} />
                <InfoRow label="Focal length (lensmaker)" value={Number.isFinite(lensInfo.f) ? `${lensInfo.f.toFixed(1)} mm` : '∞'} tone="text-pink-300" />
                <InfoRow label="Optical power" value={Number.isFinite(lensInfo.f) ? `${(1000 / lensInfo.f).toFixed(2)} D` : '0 D'} />
              </>
            )}
          </>
        )}
        {o.shape === 'fiber' && (
          <>
            <SliderRow label="Straight length" value={o.length} onChange={(v) => up({ length: v }, 'length')} min={10} max={1500} hardMax={1e5} step={1} unit="mm" precision={1} />
            <SliderRow label="Core width" value={o.fiberWidth} onChange={(v) => up({ fiberWidth: v }, 'fiberWidth')} min={2} max={120} hardMax={1000} step={0.5} unit="mm" precision={1} />
            <SliderRow label="Bend radius" value={o.bendRadius} onChange={(v) => up({ bendRadius: v }, 'bendRadius')} min={Math.ceil(o.fiberWidth / 2 + 1)} max={800} hardMax={1e5} step={1} unit="mm" precision={1} />
            <SliderRow label="Bend angle" value={o.bendAngle} onChange={(v) => up({ bendAngle: v }, 'bendAngle')} min={-180} max={180} step={1} unit="°" precision={1} />
            <InfoRow label="Acceptance half-angle" value={(() => {
              const na = Math.sqrt(Math.max(0, n * n - 1));
              return na >= 1 ? '90° (NA ≥ 1)' : `${rad2deg(Math.asin(na)).toFixed(1)}°`;
            })()} />
          </>
        )}
      </Section>
      <MaterialEditor m={o.material} onChange={(patch, key) => up({ material: { ...o.material, ...patch } }, `mat.${key}`)} onReplace={(m) => up({ material: m }, 'material')} />
    </>
  );
}

function MaterialEditor({ m, onChange, onReplace }: { m: Material; onChange: (p: Partial<Material>, key: string) => void; onReplace: (m: Material) => void }) {
  const opaque = m.transmission <= 0;
  const modified = isModified(m);
  const n = (wl: number) => cauchyIndex(m.ior, m.dispersion, wl);
  const crit = criticalAngle(m.ior, 1);
  const abbe = abbeNumber(m.ior, m.dispersion);
  return (
    <Section
      title="Material"
      right={
        modified ? (
          <button type="button" className="flex items-center gap-1 text-[10.5px] text-amber-300/90 hover:text-amber-200" onClick={() => onReplace({ ...makeMaterial(m.preset), color: m.color })} title="Restore library values">
            <RotateCcw className="h-3 w-3" /> modified
          </button>
        ) : null
      }
    >
      <FieldRow label="Preset">
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="h-7 w-7 cursor-pointer rounded-md border border-white/10 bg-transparent p-0.5"
            value={m.color}
            onChange={(e) => onChange({ color: e.target.value }, 'color')}
            title="Display colour"
          />
          <SelectInput<MaterialId>
            className="w-[150px]"
            value={m.preset}
            onChange={(id) => onReplace(makeMaterial(id))}
            options={MATERIAL_ORDER.map((id) => ({ value: id, label: MATERIALS[id].name }))}
          />
        </div>
      </FieldRow>
      <SliderRow label="Refractive index (n_D)" value={m.ior} onChange={(v) => onChange({ ior: v }, 'ior')} min={1} max={3} hardMin={1} hardMax={4} step={0.001} precision={4} disabled={opaque} />
      <SliderRow label="Dispersion (Cauchy B)" value={m.dispersion} onChange={(v) => onChange({ dispersion: v }, 'dispersion')} min={0} max={0.03} hardMax={0.1} step={0.0001} unit="µm²" precision={4} disabled={opaque} />
      <SliderRow label="Surface reflectivity" value={m.reflectivity} onChange={(v) => onChange({ reflectivity: v }, 'reflectivity')} min={0} max={1} step={0.01} precision={2} hint="Coating / metallic reflectance applied before Fresnel transmission" />
      <SliderRow label="Transmission" value={m.transmission} onChange={(v) => onChange({ transmission: v }, 'transmission')} min={0} max={1} step={0.01} precision={2} hint="Fraction of non-reflected light entering the material (0 = opaque, rest absorbed at surface)" />
      <SliderRow label="Absorption coeff." value={m.absorption} onChange={(v) => onChange({ absorption: v }, 'absorption')} min={0} max={2} hardMax={50} step={0.005} unit="/cm" precision={3} disabled={opaque} hint="Beer–Lambert attenuation inside the material" />
      <SliderRow label="Surface roughness" value={m.roughness} onChange={(v) => onChange({ roughness: v }, 'roughness')} min={0} max={1} step={0.01} precision={2} />
      {!opaque ? (
        <div className="space-y-1 rounded-lg border border-white/[0.06] bg-white/[0.015] p-2">
          <InfoRow label="n @ 450 / 550 / 650 nm" value={`${n(450).toFixed(4)} / ${n(550).toFixed(4)} / ${n(650).toFixed(4)}`} />
          <InfoRow label="Abbe number V_d" value={Number.isFinite(abbe) ? abbe.toFixed(1) : '∞'} />
          <InfoRow label="Critical angle (→ air)" value={crit !== null ? `${rad2deg(crit).toFixed(2)}°` : '—'} tone="text-pink-300" />
          <InfoRow label="Brewster angle" value={`${rad2deg(brewsterAngle(1, m.ior)).toFixed(2)}°`} />
          <InfoRow label="Normal-incidence R" value={`${(fresnelReflectance(1, m.ior, 1, 'unpolarized') * 100).toFixed(2)} %`} />
        </div>
      ) : (
        <InfoRow label="Absorbed at surface" value={`${((1 - m.reflectivity) * 100).toFixed(1)} %`} />
      )}
    </Section>
  );
}

// ───────────────────────── Others ─────────────────────────

function ThinLensProps({ o, up }: { o: ThinLensObject; up: Up }) {
  return (
    <Section title="Ideal Thin Lens">
      <SliderRow
        label="Focal length"
        value={o.focalLength}
        onChange={(v) => up({ focalLength: v === 0 ? 1 : v }, 'focalLength')}
        min={-600}
        max={600}
        hardMin={-1e5}
        hardMax={1e5}
        step={1}
        unit="mm"
        precision={1}
        hint="Positive = converging, negative = diverging"
      />
      <SliderRow label="Aperture" value={o.aperture} onChange={(v) => up({ aperture: v }, 'aperture')} min={5} max={800} hardMax={1e4} step={1} unit="mm" precision={1} />
      <InfoRow label="Type" value={o.focalLength > 0 ? 'Converging' : 'Diverging'} />
      <InfoRow label="Optical power" value={`${(1000 / o.focalLength).toFixed(2)} D`} tone="text-pink-300" />
      <p className="text-[10.5px] leading-relaxed text-slate-500">Paraxial model: every ray is redirected toward the point where the parallel chief ray meets the focal plane. No aberrations or dispersion.</p>
    </Section>
  );
}

function DetectorProps({ o, up }: { o: DetectorObject; up: Up }) {
  const reading = useTraceStore((s) => s.result?.detectors[o.id]);
  return (
    <Section title="Detector">
      <SliderRow label="Length" value={o.length} onChange={(v) => up({ length: v }, 'length')} min={5} max={800} hardMax={1e4} step={1} unit="mm" precision={1} />
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3">
        <div className="text-[10.5px] uppercase tracking-wider text-amber-300/70">Incident power</div>
        <div className="font-mono text-2xl text-amber-200">{reading ? reading.power.toFixed(4) : '—'}</div>
        <div className="text-[11px] text-slate-400">{reading ? `${reading.rays} ray hits` : 'No data'}</div>
      </div>
      <p className="text-[10.5px] leading-relaxed text-slate-500">Sum of the relative intensities of all rays absorbed by the detector (both faces).</p>
    </Section>
  );
}

function RulerProps({ o, up }: { o: RulerObject; up: Up }) {
  const ex = o.x + Math.cos((o.rotation * Math.PI) / 180) * o.length;
  const ey = o.y + Math.sin((o.rotation * Math.PI) / 180) * o.length;
  return (
    <Section title="Ruler">
      <SliderRow label="Length" value={o.length} onChange={(v) => up({ length: v }, 'length')} min={5} max={1500} hardMax={1e5} step={1} unit="mm" precision={1} />
      <InfoRow label="Start" value={`(${o.x.toFixed(1)}, ${o.y.toFixed(1)})`} />
      <InfoRow label="End" value={`(${ex.toFixed(1)}, ${ey.toFixed(1)})`} />
      <p className="text-[10.5px] text-slate-500">Drag the yellow endpoints to measure. Hold Shift to snap angle to 15°.</p>
    </Section>
  );
}

function ProtractorProps({ o, up }: { o: ProtractorObject; up: Up }) {
  return (
    <Section title="Protractor">
      <SliderRow label="First arm direction" value={o.rotation} onChange={(v) => up({ rotation: v }, 'rotation')} min={-180} max={180} step={0.5} unit="°" precision={1} />
      <SliderRow label="Measured angle" value={o.angle} onChange={(v) => up({ angle: v }, 'angle')} min={0} max={360} step={0.5} unit="°" precision={1} />
      <SliderRow label="Arm length" value={o.radius} onChange={(v) => up({ radius: v }, 'radius')} min={15} max={500} hardMax={1e4} step={1} unit="mm" precision={1} />
      <p className="text-[10.5px] text-slate-500">Drag the arm handles to align with rays or surfaces.</p>
    </Section>
  );
}

// ───────────────────────── Scene ─────────────────────────

function ScenePanel() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const objects = useStore((s) => s.objects);
  const select = useStore((s) => s.select);
  const updateObject = useStore((s) => s.updateObject);
  const result = useTraceStore((s) => s.result);
  const st = result?.stats;
  const pct = (v: number) => (st && st.emitted > 0 ? `${((v / st.emitted) * 100).toFixed(1)} %` : '—');
  const set = (k: string) => (v: number) => setSettings({ [k]: v }, `settings.${k}`);

  return (
    <div>
      <div className="border-b border-white/[0.06] px-4 pb-3 pt-4">
        <div className="brand-label text-[13px] text-coral-500">Scene</div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">Select an object to edit its properties. These settings control the ray-tracing engine.</p>
      </div>
      <Section title="Ray Tracing">
        <SliderRow label="Max ray depth" value={settings.maxDepth} onChange={set('maxDepth')} min={1} max={200} hardMax={1000} step={1} integer precision={0} hint="Maximum interactions per ray path" />
        <SliderRow label="Min intensity" value={settings.minIntensity} onChange={set('minIntensity')} min={0.0005} max={0.05} hardMin={0.00001} hardMax={0.5} step={0.0005} precision={4} hint="Rays dimmer than this are terminated" />
        <FieldRow label="Polarization">
          <SelectInput<Polarization>
            className="w-[140px]"
            value={settings.polarization}
            onChange={(v) => setSettings({ polarization: v })}
            options={[
              { value: 'unpolarized', label: 'Unpolarized' },
              { value: 's', label: 's (TE)' },
              { value: 'p', label: 'p (TM)' },
            ]}
          />
        </FieldRow>
        <SliderRow label="White-light samples" value={settings.whiteSamples} onChange={set('whiteSamples')} min={3} max={30} step={1} integer precision={0} />
        <SliderRow label="Scatter rays (rough)" value={settings.scatterRays} onChange={set('scatterRays')} min={1} max={15} step={1} integer precision={0} />
        <SliderRow label="Segment budget" value={settings.maxSegments} onChange={set('maxSegments')} min={1000} max={200000} step={1000} integer precision={0} />
        <SliderRow label="Ray brightness" value={settings.brightness} onChange={set('brightness')} min={0.2} max={4} step={0.05} precision={2} />
      </Section>
      <Section title="Energy Balance">
        {st ? (
          <>
            <InfoRow label="Emitted" value={st.emitted.toFixed(3)} />
            <InfoRow label="Escaped scene" value={pct(st.escaped)} tone="text-coral-300" />
            <InfoRow label="Absorbed" value={pct(st.absorbed)} tone="text-rose-300" />
            <InfoRow label="Detected" value={pct(st.detected)} tone="text-amber-300" />
            <InfoRow label="Below cutoff / depth" value={pct(st.truncated)} />
            <div className="my-1 h-px bg-white/[0.06]" />
            <InfoRow label="Primary rays" value={st.primaryRays} />
            <InfoRow label="Segments" value={`${st.segments}${st.limitReached ? ' (budget hit)' : ''}`} tone={st.limitReached ? 'text-amber-300' : undefined} />
            <InfoRow label="Interactions" value={st.interactions} />
            <InfoRow label="TIR events" value={st.tirEvents} />
            <InfoRow label="Trace time" value={`${result!.timeMs.toFixed(2)} ms`} />
          </>
        ) : (
          <p className="text-[11px] text-slate-500">No trace yet.</p>
        )}
      </Section>
      <Section title={`Objects (${objects.length})`}>
        <ul className="space-y-0.5">
          {[...objects].reverse().map((o) => (
            <li key={o.id}>
              <div className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/[0.05]">
                <button type="button" className="flex-1 truncate text-left text-[11.5px] text-slate-300 group-hover:text-white" onClick={() => select(o.id)}>
                  {o.name}
                </button>
                <span className="text-[10px] text-slate-600">{KIND_LABEL[o.kind]}</span>
                {o.kind === 'source' && (
                  <button type="button" className="text-slate-500 hover:text-slate-200" title={o.enabled ? 'Turn off' : 'Turn on'} onClick={() => updateObject(o.id, { enabled: !o.enabled })}>
                    {o.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[10.5px] text-slate-500">Top of the list is drawn on top. Where bodies overlap, the topmost body defines the medium.</p>
      </Section>
    </div>
  );
}
