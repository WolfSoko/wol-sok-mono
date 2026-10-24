import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Project } from '../projects';

@Component({
  selector: 'wolsok-project-card',
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--accent]': 'project().accent' },
  template: `
    <article>
      <h3>{{ project().name }}</h3>
      <p class="tagline">{{ project().tagline }}</p>
      <p>{{ project().description }}</p>
      <ul class="tech" aria-label="Built with">
        @for (tech of project().tech; track tech) {
          <li>{{ tech }}</li>
        }
      </ul>
      <nav class="links">
        @for (link of project().links; track link.url; let first = $first) {
          <a
            [matButton]="first ? 'filled' : 'outlined'"
            [href]="link.url"
            [attr.aria-label]="link.label + ': ' + project().name"
            >{{ link.label }}</a
          >
        }
      </nav>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    article {
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1.5rem;
      border-radius: 1.25rem;
      background:
        radial-gradient(
          circle at 100% 0%,
          color-mix(in srgb, var(--accent) 22%, transparent),
          transparent 55%
        ),
        var(--surface);
      border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--line));
      transition:
        transform 0.2s ease,
        border-color 0.2s ease;
    }
    article:hover {
      transform: translateY(-3px);
      border-color: var(--accent);
    }
    h3 {
      margin: 0;
      font-size: 1.35rem;
      color: var(--accent);
    }
    p {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
    }
    .tagline {
      color: var(--text);
      font-weight: 600;
    }
    .tech {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin: 0.25rem 0 0;
      padding: 0;
      list-style: none;
    }
    .tech li {
      font-size: 0.75rem;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent) 14%, transparent);
      color: var(--text);
    }
    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: auto;
      padding-top: 0.75rem;
    }
  `,
})
export class ProjectCardComponent {
  public readonly project = input.required<Project>();
}
