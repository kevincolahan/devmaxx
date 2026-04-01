/**
 * Emergency Railway service restart via GraphQL API.
 *
 * Usage:
 *   RAILWAY_API_TOKEN=<token> npx tsx apps/api/src/scripts/railway-restart.ts
 *
 * Get your token from: https://railway.app/account/tokens
 * Set it as an env var or pass inline.
 */

const RAILWAY_API = 'https://backboard.railway.app/graphql/v2';

async function main() {
  const token = process.env.RAILWAY_API_TOKEN;
  if (!token) {
    console.error('Set RAILWAY_API_TOKEN env var. Get one at https://railway.app/account/tokens');
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Step 1: List projects to find devmaxx
  console.log('Fetching projects...');
  const projectsRes = await fetch(RAILWAY_API, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: `query { me { projects { edges { node { id name } } } } }`,
    }),
  });

  const projectsData = (await projectsRes.json()) as {
    data: { me: { projects: { edges: Array<{ node: { id: string; name: string } }> } } };
  };

  const projects = projectsData.data.me.projects.edges.map((e) => e.node);
  console.log('Projects:', projects.map((p) => `${p.name} (${p.id})`).join(', '));

  const devmaxx = projects.find((p) => p.name.toLowerCase().includes('devmaxx'));
  if (!devmaxx) {
    console.error('No devmaxx project found. Projects:', projects.map((p) => p.name));
    process.exit(1);
  }

  console.log(`Found project: ${devmaxx.name} (${devmaxx.id})`);

  // Step 2: List services in the project
  console.log('Fetching services...');
  const servicesRes = await fetch(RAILWAY_API, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: `query($projectId: String!) {
        project(id: $projectId) {
          services { edges { node { id name } } }
          environments { edges { node { id name } } }
        }
      }`,
      variables: { projectId: devmaxx.id },
    }),
  });

  const servicesData = (await servicesRes.json()) as {
    data: {
      project: {
        services: { edges: Array<{ node: { id: string; name: string } }> };
        environments: { edges: Array<{ node: { id: string; name: string } }> };
      };
    };
  };

  const services = servicesData.data.project.services.edges.map((e) => e.node);
  const environments = servicesData.data.project.environments.edges.map((e) => e.node);

  console.log('Services:', services.map((s) => `${s.name} (${s.id})`).join(', '));
  console.log('Environments:', environments.map((e) => `${e.name} (${e.id})`).join(', '));

  const apiService = services.find((s) =>
    s.name.toLowerCase().includes('api') || s.name.toLowerCase().includes('backend')
  ) ?? services[0];

  const prodEnv = environments.find((e) =>
    e.name.toLowerCase().includes('prod')
  ) ?? environments[0];

  if (!apiService) {
    console.error('No API service found');
    process.exit(1);
  }

  console.log(`\nRestarting: ${apiService.name} (${apiService.id}) in ${prodEnv?.name ?? 'default'}`);

  // Step 3: Restart the service
  const restartRes = await fetch(RAILWAY_API, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: `mutation($serviceId: String!, $environmentId: String!) {
        serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
      }`,
      variables: {
        serviceId: apiService.id,
        environmentId: prodEnv?.id ?? '',
      },
    }),
  });

  const restartData = (await restartRes.json()) as { data?: unknown; errors?: Array<{ message: string }> };

  if (restartData.errors) {
    console.error('Restart failed:', restartData.errors.map((e) => e.message).join(', '));
    process.exit(1);
  }

  console.log('Restart triggered successfully!');
  console.log('Check status at: https://railway.app/dashboard');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
