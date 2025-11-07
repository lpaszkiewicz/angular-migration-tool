// Sample Angular component with multiple migration opportunities
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-demo', // Should be removed in Angular 17+
  template: `
    <div>
      <h1>Demo Component</h1>
      <p>{{ message }}</p>
    </div>
  `,
    standalone: true
})
export class DemoComponent {
  message = 'Hello from Angular!';

  constructor(private http: HttpClient) {
    // Constructor injection - could migrate to inject()
  }

  loadData() {
    this.http.get('/api/data').subscribe(data => {
      console.log(data);
    });
  }
}
