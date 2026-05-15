import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useProjectBuilder, api } from './useProjectBuilder'

// Since 'api' is now exported from the same file as useProjectBuilder,
// we can spy on its methods directly.
// Note: Vitest's vi.mock for the same file can be tricky, 
// so we'll use vi.spyOn on the exported api object.

describe('useProjectBuilder store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset state
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
    // Setup spy
    const getMockStatusSpy = vi.spyOn(api, 'getMockStatus')
    getMockStatusSpy.mockResolvedValue('running')
    
    // Set project
    useProjectBuilder.setState({ 
      project: { 
        ...useProjectBuilder.getState().project, 
        remoteId: 'test-project' 
      } 
    })
    
    // Execute
    await useProjectBuilder.getState().checkMockStatus()
    
    // Verify
    expect(getMockStatusSpy).toHaveBeenCalledWith('test-project')
    expect(useProjectBuilder.getState().mockRunning).toBe(true)
  })

  it('should set mockRunning to false if API fails', async () => {
    const getMockStatusSpy = vi.spyOn(api, 'getMockStatus')
    getMockStatusSpy.mockRejectedValue(new Error('API Down'))
    
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
