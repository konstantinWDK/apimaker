import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Shield, Layout, Server, CheckCircle, ArrowRight, Loader2, Box } from 'lucide-react';
import './SetupWizard.css';
import { readBackendConfig } from '../lib/backendConfig';

interface SetupWizardProps {
  onComplete: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    admin_username: 'admin',
    admin_password: '',
    admin_email: '',
    database_type: 'sqlite',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: '',
    database: 'doapi',
    import_sample_data: true,
    use_docker: false
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
               type === 'number' ? parseInt(value || '0') : value
    }));
  };

  const handleRunSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = readBackendConfig().baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'
      const response = await fetch(`${baseUrl}/setup/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || t('login.error'));
      }
      
      setStep(4);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-wizard-overlay">
      <div className="setup-wizard-container">
        
        {/* Sidebar */}
        <div className="setup-wizard-sidebar">
          <div className="setup-wizard-logo">
            <div className="logo-icon">
              <Server size={24} color="white" />
            </div>
            <span className="logo-text">DoApi</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <StepItem icon={<Shield />} label={t('setup.stepAdmin')} active={step === 1} completed={step > 1} />
            <StepItem icon={<Database />} label={t('setup.stepDatabase')} active={step === 2} completed={step > 2} />
            <StepItem icon={<Layout />} label={t('setup.stepOptions')} active={step === 3} completed={step > 3} />
            <StepItem icon={<CheckCircle />} label={t('setup.stepFinish')} active={step === 4} completed={step > 4} />
          </div>
        </div>

        {/* Content */}
        <div className="setup-wizard-content">
          {step === 1 && (
            <div className="animate-in">
              <h2 className="step-title">{t('setup.title')}</h2>
              <p className="step-subtitle">{t('setup.subtitle')}</p>
              
              <div className="form-fields">
                <Field label={t('setup.username')} name="admin_username" value={formData.admin_username} onChange={handleChange} placeholder={t('setup.usernamePlaceholder')} />
                <Field label={t('setup.password')} name="admin_password" value={formData.admin_password} onChange={handleChange} type="password" placeholder={t('setup.passwordPlaceholder')} />
                <Field label={t('setup.email')} name="admin_email" value={formData.admin_email} onChange={handleChange} type="email" placeholder={t('setup.emailPlaceholder')} />
              </div>
              
              <button 
                type="button"
                onClick={() => setStep(2)}
                disabled={!formData.admin_username || !formData.admin_password}
                className="btn-primary"
                style={{ marginTop: '2rem' }}
              >
                {t('setup.nextStep')} <ArrowRight size={18} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in">
              <h2 className="step-title">{t('setup.dbTitle')}</h2>
              <p className="step-subtitle">{t('setup.dbSubtitle')}</p>
              
              <div className="form-fields" style={{ overflowY: 'auto', maxHeight: '300px', paddingRight: '0.5rem' }}>
                <div className="db-grid">
                  <div 
                    onClick={() => setFormData(p => ({...p, database_type: 'sqlite'}))}
                    className={`db-option ${formData.database_type === 'sqlite' ? 'active' : ''}`}
                  >
                    <div className="db-option-title">{t('setup.sqlite')}</div>
                    <div className="db-option-desc">{t('setup.sqliteDesc')}</div>
                  </div>
                  <div 
                    onClick={() => setFormData(p => ({...p, database_type: 'postgresql'}))}
                    className={`db-option ${formData.database_type === 'postgresql' ? 'active' : ''}`}
                  >
                    <div className="db-option-title">{t('setup.postgres')}</div>
                    <div className="db-option-desc">{t('setup.postgresDesc')}</div>
                  </div>
                </div>

                {formData.database_type === 'postgresql' && (
                  <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <Field label={t('setup.host')} name="host" value={formData.host} onChange={handleChange} placeholder={t('setup.hostPlaceholder')} />
                    <div className="db-grid">
                      <Field label={t('setup.port')} name="port" value={formData.port} onChange={handleChange} type="number" />
                      <Field label={t('setup.database')} name="database" value={formData.database} onChange={handleChange} />
                    </div>
                    <Field label={t('setup.user')} name="username" value={formData.username} onChange={handleChange} />
                    <Field label={t('setup.password')} name="password" value={formData.password} onChange={handleChange} type="password" />
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setStep(1)} className="btn-secondary">{t('setup.back')}</button>
                <button 
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn-primary"
                  style={{ flex: 1 }}
                >
                  {t('setup.nextStep')} <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in">
              <h2 className="step-title">{t('setup.optionsTitle')}</h2>
              <p className="step-subtitle">{t('setup.optionsSubtitle')}</p>
              
              <div className="form-fields">
                <label className="checkbox-card">
                  <input 
                    type="checkbox" 
                    name="import_sample_data" 
                    checked={formData.import_sample_data} 
                    onChange={handleChange}
                    className="checkbox-input"
                  />
                  <div>
                    <div className="checkbox-title">{t('setup.importDemo')}</div>
                    <div className="checkbox-desc">{t('setup.importDemoDesc')}</div>
                  </div>
                </label>

                <label className="checkbox-card" style={{ borderColor: formData.use_docker ? '#6366f1' : '#334155' }}>
                  <input 
                    type="checkbox" 
                    name="use_docker" 
                    checked={formData.use_docker} 
                    onChange={handleChange}
                    className="checkbox-input"
                  />
                  <div>
                    <div className="checkbox-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Box size={16} color="#818cf8" />
                      <span>{t('setup.useDocker')}</span>
                    </div>
                    <div className="checkbox-desc">{t('setup.useDockerDesc')}</div>
                  </div>
                </label>

                {error && (
                  <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '0.75rem', color: '#f87171', fontSize: '0.875rem' }}>
                    {error}
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setStep(2)} className="btn-secondary">{t('setup.back')}</button>
                <button 
                  type="button"
                  onClick={handleRunSetup}
                  disabled={loading}
                  className="btn-primary"
                  style={{ flex: 1 }}
                >
                  {loading ? <Loader2 className="spin" size={20} /> : t('setup.finish')}
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-in" style={{ textAlign: 'center', margin: 'auto' }}>
              <div style={{ width: '5rem', height: '5rem', backgroundColor: 'rgba(34, 197, 94, 0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <CheckCircle size={40} color="#22c55e" />
              </div>
              <h2 className="step-title">{t('setup.complete')}</h2>
              <p className="step-subtitle" style={{ maxWidth: '20rem', margin: '0 auto 2rem' }}>
                {formData.use_docker 
                  ? t('setup.dockerReady')
                  : t('setup.ready')}
              </p>
              
              <button 
                type="button"
                onClick={onComplete}
                className="btn-primary"
                style={{ maxWidth: '200px', margin: '0 auto' }}
              >
                {t('setup.goToDashboard')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StepItem = ({ icon, label, active, completed }: { icon: React.ReactNode, label: string, active: boolean, completed: boolean }) => (
  <div className={`step-item ${active ? 'active' : completed ? 'completed' : ''}`} style={{ marginBottom: '1rem' }}>
    <div className="step-icon">
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { size: 16 }) : icon}
    </div>
    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{label}</span>
  </div>
);

const Field = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="field-group">
    <label className="field-label">{label}</label>
    <input {...props} className="field-input" />
  </div>
);
