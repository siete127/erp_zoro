import api from './api';

export const getGlobalApprovalEmail = async () => {
  const res = await api.get('/config/email-aprobacion');
  return res.data?.email || '';
};

export const updateGlobalApprovalEmail = async (email) => {
  const res = await api.put('/config/email-aprobacion', { email });
  return res.data;
};

export const getCompanyPriceEmails = async (companyId) => {
  const res = await api.get('/config/precio-emails', {
    params: { company_id: companyId }
  });
  return {
    email1: res.data.email1 || '',
    email2: res.data.email2 || ''
  };
};

export const updateCompanyPriceEmails = async (companyId, email1, email2) => {
  const res = await api.put('/config/precio-emails', { company_id: companyId, email1, email2 });
  return res.data;
};
