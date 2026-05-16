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
})
