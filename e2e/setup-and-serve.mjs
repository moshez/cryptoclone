/* Playwright starts webServer before globalSetup runs, so the fixture
 * builds happen here, in the server command itself. */
import globalSetup from './global-setup.mjs';
import { makeServer } from './serve.mjs';

globalSetup();
makeServer('.serve/current', '/cryptoclone/').listen(4173, () => {
  console.log('serving .serve/current at http://localhost:4173/cryptoclone/');
});
