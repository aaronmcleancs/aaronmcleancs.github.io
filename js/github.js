const projectConfig = {
  'CVV_15M_SARS-CoV-2': {
    owner: 'aaronmcleancs',
    repo: 'CVV_15M_SARS-CoV-2',
    title: 'Medical Imaging AI: X-Ray Diagnosis System',
    description: 'Compact, high-performance TensorFlow vision model for detecting COVID-19 and Viral Pneumonia cases from lung x-rays, deployable on mobile hardware with high accuracy in resource-constrained environments.',
    section: 0,
    skills: ['Python', 'TensorFlow', 'Machine Learning', 'Computer Vision', 'Amazon Web Services (AWS)']
  },
  'RepBook': {
    owner: 'aaronmcleancs',
    repo: 'RepBook-DemoServer',
    title: 'Full Stack Fitness Assistant',
    description: 'Full-stack iOS fitness dashboard with secure user authentication, normalized backend and dynamic AI assistant with semantics fetching.',
    section: 1,
    skills: ['Swift', 'iOS Development', 'Node.js', 'PostgreSQL', 'Secure Authentication', 'REST']
  },
  'ParticleBox': {
    owner: 'aaronmcleancs',
    repo: 'ParticleBox',
    title: 'High Performance Particle Simulator',
    description: 'A rigourously optimized multithreaded particle dynamics engine engineered to push the upper bound of simotaniously simulated objects, visualizing interactions among thousands of particles in real-time with efficient rendering.',
    section: 2,
    skills: ['C++', 'Systems Programming', 'Optimization', 'Multithreading', 'Real-time Rendering']
  },
  'Quantum': {
    owner: 'aaronmcleancs',
    repo: 'FidelityChain',
    title: 'Quantum-Assisted Consensus Protocol',
    description: 'Quantum safe blockchain consensus protocol replacing proof-of-work with quantum state fidelity checks, reducing computational complexity and energy impact.',
    section: 3,
    skills: ['Quantum Computing', 'Distributed Systems', 'Qiskit', 'Blockchain', 'Secure Communications']
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const showcaseHero = document.querySelector('.showcase__hero');
  if (!showcaseHero) return;
  let currentProjectKey = showcaseHero.getAttribute('data-project');
  if (!currentProjectKey) {
    const page = location.pathname.split('/').pop().split('.')[0].toLowerCase();
    if (page.includes('cnn')) {
      currentProjectKey = 'CVV_15M_SARS-CoV-2';
    } else if (page.includes('ios')) {
      currentProjectKey = 'RepBook';
    } else if (page.includes('particle')) {
      currentProjectKey = 'ParticleBox';
    } else if (page.includes('quantum')) {
      currentProjectKey = 'Quantum';
    }
  }
  const project = projectConfig[currentProjectKey];
  if (project) {
    initializeProjectCard(project, showcaseHero);
    fetchGitHubData(project, showcaseHero);
  } else {
    console.error('No matching project configuration found for the current page.');
  }
});

function initializeProjectCard(project, container) {
  const titleElement = container.querySelector('.project-title');
  if (titleElement) titleElement.textContent = project.title || project.repo.replace(/-/g, ' ');
  const descriptionElement = container.querySelector('.project-description');
  if (descriptionElement) descriptionElement.textContent = project.description;
  const repoLink = container.querySelector('.project-repo-link');
  if (repoLink) {
    repoLink.href = `https://github.com/${project.owner}/${project.repo}`;
  }
  const skillsElement = container.querySelector('.project-language');
  if (skillsElement && project.skills) {
    skillsElement.textContent = project.skills.join(' · ');
  }
  const updatedElement = container.querySelector('.updated-date');
  if (updatedElement) {
    updatedElement.style.cursor = 'pointer';
    updatedElement.addEventListener('click', () => {
      window.open(`https://github.com/${project.owner}/${project.repo}`, '_blank');
    });
  }
}

async function fetchGitHubData(project, container) {
  try {
    const repoResponse = await fetch(`https://api.github.com/repos/${project.owner}/${project.repo}`);
    if (!repoResponse.ok) throw new Error(`GitHub API error: ${repoResponse.status}`);
    const repoData = await repoResponse.json();
    updateProjectCard(repoData, container);
  } catch (error) {
    console.error('Error fetching GitHub data:', error);
    setFallbackData(project, container);
  }
}

function updateProjectCard(data, container) {
  const starsElement = container.querySelector('.stars-count');
  if (starsElement) starsElement.textContent = formatNumber(data.stargazers_count);
  const forksElement = container.querySelector('.forks-count');
  if (forksElement) forksElement.textContent = formatNumber(data.forks_count);
  const watchersElement = container.querySelector('.watchers-count');
  if (watchersElement) watchersElement.textContent = formatNumber(data.watchers_count);
  const licenseElement = container.querySelector('.project-license');
  if (licenseElement) {
    licenseElement.textContent = data.license ? data.license.name : 'No License';
  }
  const updatedElement = container.querySelector('.updated-date');
  if (updatedElement && data.pushed_at) {
    updatedElement.innerHTML = formatDate(data.pushed_at) + ' <span class="external-icon" style="margin-left: 4px;">↗</span>';
  }
}

function setFallbackData(project, container) {
  const skillsElement = container.querySelector('.project-language');
  if (skillsElement) {
    skillsElement.textContent = project.skills ? project.skills.join(' · ') : 'N/A';
  }
  const licenseElement = container.querySelector('.project-license');
  if (licenseElement) {
    licenseElement.textContent = 'MIT License';
  }
  const statsElements = container.querySelectorAll('.stat-count');
  statsElements.forEach(el => {
    el.textContent = '–';
  });
  const updatedElement = container.querySelector('.updated-date');
  if (updatedElement) {
    updatedElement.innerHTML = 'Recently <span class="external-icon" style="margin-left: 4px;">↗</span>';
  }
}

function formatNumber(num) {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  }
}