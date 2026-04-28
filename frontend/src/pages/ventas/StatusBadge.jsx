const StatusBadge = ({ statusId, statusNombre }) => {
  const getStatusColor = (id) => {
    const colors = {
      1: 'bg-yellow-100 text-yellow-800',
      2: 'bg-blue-100 text-blue-800',
      3: 'bg-green-100 text-green-800',
      4: 'bg-red-100 text-red-800',
      5: 'bg-purple-100 text-purple-800'
    };
    return colors[id] || 'bg-gray-100 text-gray-800';
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(statusId)}`}>
      {statusNombre}
    </span>
  );
};

export default StatusBadge;
