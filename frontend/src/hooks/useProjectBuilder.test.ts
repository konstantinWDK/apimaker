import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useProjectBuilder } from './useProjectBuilder'
import * as api from '../lib/api'

vi.mock('../lib/api', () => ({
  fetchRemoteProjects: vi.fn(),
  createProjectFromDraft: vi.fn(),
  updateProject: vi.fn(),
  syncDataset: vi.fn(),
  syncEndpoints: vi.fn(),
  startMockServer: vi.fn(),
  stopMockServer: vi.fn(),
  getMockStatus: vi.fn(),
  deleteRemoteProject: vi.fn(),
}))

describe('useProjectBuilder store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProjectBuilder.setState({
      project: {
        id: 'initial-id',
        name: 'Initial Project',
        description: '',
        authMethod: 'none',
        targetStack: 'fastapi',
        endpoints: [],
        datasets: []
      },
      mockRunning: false
    })
  })

  it('should initialize with default state', () => {
    const state = useProjectBuilder.getState()
    expect(state.project.name).toBeDefined()
    expect(state.mockRunning).toBe(false)
  })

  it('should update mockRunning status when checkMockStatus is called', async () => {
    vi.mocked(api.getMockStatus).mockResolvedValue('running')
    
    useProjectBuilder.setState({ 
      project: { 
        ...useProjectBuilder.getState().project, 
        remoteId: 'test-project' 
      } 
    })
    
    await useProjectBuilder.getState().checkMockStatus()
    
    expect(api.getMockStatus).toHaveBeenCalledWith('test-project')
    expect(useProjectBuilder.getState().mockRunning).toBe(true)
  })

  it('should set mockRunning to false if API fails', async () => {
    vi.mocked(api.getMockStatus).mockRejectedValue(new Error('API Down'))
    
    useProjectBuilder.setState({ 
      project: { 
        ...useProjectBuilder.getState().project, 
        remoteId: 'test-project' 
      } 
    })

    await useProjectBuilder.getState().checkMockStatus()
    
    expect(useProjectBuilder.getState().mockRunning).toBe(false)
  })

  it('should keep project visible when remote deletion fails', async () => {
    vi.mocked(api.deleteRemoteProject).mockRejectedValue(new Error('Project admin access required'))
    vi.mocked(api.fetchRemoteProjects).mockResolvedValue([])
    useProjectBuilder.setState({
      project: {
        id: 'project-1',
        remoteId: 'remote-1',
        name: 'Protected Project',
        description: '',
        authMethod: 'none',
        targetStack: 'fastapi',
        endpoints: [],
        datasets: [],
      },
      projects: [
        {
          id: 'project-1',
          remoteId: 'remote-1',
          name: 'Protected Project',
          description: '',
          authMethod: 'none',
          targetStack: 'fastapi',
          endpoints: [],
          datasets: [],
        },
      ],
    })

    await expect(useProjectBuilder.getState().deleteProject('project-1')).rejects.toThrow('Project admin access required')
    expect(useProjectBuilder.getState().projects).toHaveLength(1)
  })

  it('should replace matching project by slug without duplicating it', () => {
    useProjectBuilder.setState({
      project: {
        id: 'local-id',
        remoteId: 'my-api',
        slug: 'my-api',
        name: 'My API',
        description: '',
        authMethod: 'none',
        targetStack: 'fastapi',
        endpoints: [],
        datasets: [],
      },
      projects: [
        {
          id: 'local-id',
          remoteId: 'my-api',
          slug: 'my-api',
          name: 'My API',
          description: '',
          authMethod: 'none',
          targetStack: 'fastapi',
          endpoints: [],
          datasets: [],
        },
      ],
    })

    useProjectBuilder.getState().replaceProject({
      id: 'backend-id',
      remoteId: 'my-api',
      slug: 'my-api',
      name: 'My API',
      description: '',
      authMethod: 'none',
      targetStack: 'fastapi',
      endpoints: [],
      datasets: [{ id: 'imported-dataset', name: 'Imported', sourceType: 'database', fields: [], sampleRows: [] }],
    })

    const state = useProjectBuilder.getState()
    expect(state.project.id).toBe('backend-id')
    expect(state.projects).toHaveLength(1)
    expect(state.projects[0].datasets).toHaveLength(1)
  })

  it('should handle saveProject correctly when project has remoteId and update succeeds', async () => {
    vi.mocked(api.updateProject).mockResolvedValue(true)
    vi.mocked(api.fetchRemoteProjects).mockResolvedValue([])
    window.sessionStorage.setItem('doapi-jwt-token', 'fake-token')

    useProjectBuilder.setState({
      project: {
        id: 'local-id',
        remoteId: 'my-api',
        slug: 'my-api',
        name: 'My API',
        description: '',
        authMethod: 'none',
        targetStack: 'fastapi',
        endpoints: [],
        datasets: [],
      },
    })

    const result = await useProjectBuilder.getState().saveProject()
    expect(result).toBe('my-api')
    window.sessionStorage.removeItem('doapi-jwt-token')
  })

  it('should return null from saveProject when update fails and recovery fails', async () => {
    vi.mocked(api.updateProject).mockResolvedValue(false)
    vi.mocked(api.fetchRemoteProjects).mockResolvedValue([])
    vi.mocked(api.createProjectFromDraft).mockResolvedValue(null)

    useProjectBuilder.setState({
      project: {
        id: 'local-id',
        remoteId: 'my-api',
        slug: 'my-api',
        name: 'My API',
        description: '',
        authMethod: 'none',
        targetStack: 'fastapi',
        endpoints: [],
        datasets: [],
      },
    })

    const result = await useProjectBuilder.getState().saveProject()
    expect(result).toBeNull()
  })

  it('should handle replaceProject with result.project_id matching current project remoteId', () => {
    useProjectBuilder.setState({
      project: {
        id: 'local-uuid',
        remoteId: 'my-api',
        slug: 'my-api',
        name: 'My API',
        description: '',
        authMethod: 'none',
        targetStack: 'fastapi',
        endpoints: [],
        datasets: [],
      },
      projects: [
        {
          id: 'local-uuid',
          remoteId: 'my-api',
          slug: 'my-api',
          name: 'My API',
          description: '',
          authMethod: 'none',
          targetStack: 'fastapi',
          endpoints: [],
          datasets: [],
        },
      ],
    })

    // Simulate what handleImportTable does:
    // fetchRemoteProject returns project with backend UUID
    const backendProject = {
      id: 'backend-uuid',
      remoteId: 'my-api',
      slug: 'my-api',
      name: 'My API',
      description: '',
      authMethod: 'none',
      targetStack: 'fastapi',
      endpoints: [],
      datasets: [{ id: 'new-dataset', name: 'Imported', sourceType: 'database', fields: [], sampleRows: [] }],
    }

    useProjectBuilder.getState().replaceProject(backendProject)

    const state = useProjectBuilder.getState()
    // Should replace, not duplicate
    expect(state.projects).toHaveLength(1)
    expect(state.project.datasets).toHaveLength(1)
    expect(state.project.datasets[0].name).toBe('Imported')
  })

  it('should deduplicate local and remote project entries when loading projects', () => {
    useProjectBuilder.setState({
      project: {
        id: 'local-id',
        remoteId: 'my-api',
        slug: 'my-api',
        name: 'My API Local',
        description: '',
        authMethod: 'none',
        targetStack: 'fastapi',
        endpoints: [],
        datasets: [],
      },
      projects: [
        {
          id: 'local-id',
          remoteId: 'my-api',
          slug: 'my-api',
          name: 'My API Local',
          description: '',
          authMethod: 'none',
          targetStack: 'fastapi',
          endpoints: [],
          datasets: [],
        },
      ],
    })

    useProjectBuilder.getState().loadProjects([
      {
        id: 'backend-id',
        remoteId: 'my-api',
        slug: 'my-api',
        name: 'My API Remote',
        description: '',
        authMethod: 'none',
        targetStack: 'fastapi',
        endpoints: [],
        datasets: [{ id: 'remote-dataset', name: 'Remote', sourceType: 'database', fields: [], sampleRows: [] }],
      },
    ])

    const state = useProjectBuilder.getState()
    expect(state.project.id).toBe('backend-id')
    expect(state.projects).toHaveLength(1)
    expect(state.projects[0].id).toBe('backend-id')
    expect(state.projects[0].datasets).toHaveLength(1)
  })
})
