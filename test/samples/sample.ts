// Sample that is missing ChangeDetectionStrategy import
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-sample',
  template: `<div>Hello</div>`,
    standalone: true
})
export class SampleComponent {
  // nothing
}
