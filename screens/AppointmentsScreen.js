import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Platform,
  SectionList,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../supabase';

const AppointmentsScreen = ({ navigation }) => {
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [activeTab, setActiveTab] = useState('future'); // 'past', 'today', 'future'

  // Estados para o formulário de agendamento
  const [formData, setFormData] = useState({
    client_id: '',
    service_id: '',
    appointment_time: new Date(),
    status: 'scheduled',
    notes: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      getAppointments(),
      getClients(),
      getServices(),
    ]);
    setLoading(false);
  };

  const getAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          clients(id, name),
          services(id, name, price, duration_minutes)
        `)
        .order('appointment_time', { ascending: true });

      if (error) {
        console.log('Erro ao buscar agendamentos:', error);
        Alert.alert('Erro', 'Não foi possível carregar os agendamentos');
      } else {
        setAppointments(data || []);
      }
    } catch (error) {
      console.log('Erro:', error);
      Alert.alert('Erro', 'Ocorreu um erro inesperado ao buscar agendamentos');
    }
  };

  const getClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        console.log('Erro ao buscar clientes:', error);
      } else {
        setClients(data || []);
      }
    } catch (error) {
      console.log('Erro:', error);
    }
  };

  const getServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, price')
        .order('name', { ascending: true });

      if (error) {
        console.log('Erro ao buscar serviços:', error);
      } else {
        setServices(data || []);
      }
    } catch (error) {
      console.log('Erro:', error);
    }
  };

  // Função para categorizar agendamentos por tempo
  const categorizeAppointments = () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const past = [];
    const today = [];
    const future = [];

    appointments.forEach(appointment => {
      const appointmentDate = new Date(appointment.appointment_time);
      
      if (appointmentDate < todayStart) {
        past.push(appointment);
      } else if (appointmentDate >= todayStart && appointmentDate < todayEnd) {
        today.push(appointment);
      } else {
        future.push(appointment);
      }
    });

    return { past, today, future };
  };

  // Função para organizar agendamentos em seções
  const organizeAppointmentsByDate = (appointmentsList) => {
    const sections = {};
    
    appointmentsList.forEach(appointment => {
      const date = new Date(appointment.appointment_time);
      const monthYear = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const dayWeek = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
      
      if (!sections[monthYear]) {
        sections[monthYear] = {};
      }
      
      if (!sections[monthYear][dayWeek]) {
        sections[monthYear][dayWeek] = [];
      }
      
      sections[monthYear][dayWeek].push(appointment);
    });

    // Converter para formato de SectionList
    const sectionData = [];
    Object.keys(sections).forEach(monthYear => {
      Object.keys(sections[monthYear]).forEach(dayWeek => {
        sectionData.push({
          title: dayWeek,
          monthYear: monthYear,
          data: sections[monthYear][dayWeek]
        });
      });
    });

    return sectionData;
  };

  const getActiveAppointments = () => {
    const categorized = categorizeAppointments();
    
    switch(activeTab) {
      case 'past':
        return organizeAppointmentsByDate(categorized.past.reverse());
      case 'today':
        return organizeAppointmentsByDate(categorized.today);
      case 'future':
        return organizeAppointmentsByDate(categorized.future);
      default:
        return [];
    }
  };

  const getTabCounts = () => {
    const categorized = categorizeAppointments();
    return {
      past: categorized.past.length,
      today: categorized.today.length,
      future: categorized.future.length
    };
  };

  const openModal = (appointment = null) => {
    if (appointment) {
      setEditingAppointment(appointment);
      setFormData({
        client_id: appointment.client_id,
        service_id: appointment.service_id,
        appointment_time: new Date(appointment.appointment_time),
        status: appointment.status,
        notes: appointment.notes || '',
      });
    } else {
      setEditingAppointment(null);
      setFormData({
        client_id: clients.length > 0 ? clients[0].id : '',
        service_id: services.length > 0 ? services[0].id : '',
        appointment_time: new Date(),
        status: 'scheduled',
        notes: '',
      });
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingAppointment(null);
    setFormData({
      client_id: '',
      service_id: '',
      appointment_time: new Date(),
      status: 'scheduled',
      notes: '',
    });
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const saveAppointment = async () => {
    if (!formData.client_id || !formData.service_id || !formData.appointment_time) {
      Alert.alert('Erro', 'Cliente, Serviço e Data/Hora são obrigatórios');
      return;
    }

    try {
      const appointmentData = {
        client_id: formData.client_id,
        service_id: formData.service_id,
        appointment_time: formData.appointment_time.toISOString(),
        status: formData.status,
        notes: formData.notes.trim(),
      };

      if (editingAppointment) {
        const { error } = await supabase
          .from('appointments')
          .update(appointmentData)
          .eq('id', editingAppointment.id);

        if (error) {
          Alert.alert('Erro ao atualizar agendamento', error.message);
          return;
        }
        Alert.alert('Sucesso', 'Agendamento atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('appointments')
          .insert([appointmentData]);

        if (error) {
          Alert.alert('Erro ao adicionar agendamento', error.message);
          return;
        }
        Alert.alert('Sucesso', 'Agendamento adicionado com sucesso!');
      }

      closeModal();
      fetchData();
    } catch (error) {
      console.log('Erro ao salvar agendamento:', error);
      Alert.alert('Erro', 'Ocorreu um erro inesperado ao salvar agendamento');
    }
  };

  const deleteAppointment = (appointment) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir o agendamento de ${appointment.clients?.name} para ${new Date(appointment.appointment_time).toLocaleString('pt-BR')}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('appointments')
                .delete()
                .eq('id', appointment.id);

              if (error) {
                Alert.alert('Erro ao excluir agendamento', error.message);
                return;
              }

              Alert.alert('Sucesso', 'Agendamento excluído com sucesso!');
              fetchData();
            } catch (error) {
              console.log('Erro ao excluir agendamento:', error);
              Alert.alert('Erro', 'Ocorreu um erro inesperado ao excluir agendamento');
            }
          },
        },
      ]
    );
  };

  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || formData.appointment_time;
    setShowDatePicker(Platform.OS === 'ios');
    setFormData({ ...formData, appointment_time: currentDate });
  };

  const onTimeChange = (event, selectedTime) => {
    const currentTime = selectedTime || formData.appointment_time;
    setShowTimePicker(Platform.OS === 'ios');
    setFormData({ ...formData, appointment_time: currentTime });
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'scheduled': return '#007AFF';
      case 'completed': return '#28a745';
      case 'cancelled': return '#dc3545';
      default: return '#666';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'scheduled': return 'Agendado';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const renderAppointmentItem = ({ item }) => (
    <View style={styles.appointmentCard}>
      <View style={styles.timeContainer}>
        <Text style={styles.appointmentTime}>{formatTime(item.appointment_time)}</Text>
      </View>
      <View style={styles.appointmentInfo}>
        <Text style={styles.appointmentClient}>
          {item.clients?.name || 'Cliente não encontrado'}
        </Text>
        <Text style={styles.appointmentService}>
          {item.services?.name || 'Serviço não encontrado'}
        </Text>
        <View style={styles.appointmentMeta}>
          <Text style={[styles.appointmentStatus, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
          {item.services?.price && (
            <Text style={styles.appointmentPrice}>R$ {item.services.price}</Text>
          )}
        </View>
        {item.notes && (
          <Text style={styles.appointmentNotes}>📝 {item.notes}</Text>
        )}
      </View>
      <View style={styles.appointmentActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => openModal(item)}
        >
          <Text style={styles.actionButtonText}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteActionButton]}
          onPress={() => deleteAppointment(item)}
        >
          <Text style={styles.actionButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSectionHeader = ({ section }) => {
    const isFirstOfMonth = section === getActiveAppointments().find(s => s.monthYear === section.monthYear);
    
    return (
      <View>
        {isFirstOfMonth && (
          <View style={styles.monthHeader}>
            <Text style={styles.monthHeaderText}>{section.monthYear}</Text>
          </View>
        )}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{section.title}</Text>
          <Text style={styles.sectionCount}>{section.data.length} agendamento(s)</Text>
        </View>
      </View>
    );
  };

  const tabCounts = getTabCounts();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agendamentos</Text>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => openModal()}
        >
          <Text style={styles.addButtonText}>+ Novo</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
            Passados
          </Text>
          {tabCounts.past > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{tabCounts.past}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'today' && styles.activeTab]}
          onPress={() => setActiveTab('today')}
        >
          <Text style={[styles.tabText, activeTab === 'today' && styles.activeTabText]}>
            Hoje
          </Text>
          {tabCounts.today > 0 && (
            <View style={[styles.tabBadge, styles.todayBadge]}>
              <Text style={styles.tabBadgeText}>{tabCounts.today}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'future' && styles.activeTab]}
          onPress={() => setActiveTab('future')}
        >
          <Text style={[styles.tabText, activeTab === 'future' && styles.activeTabText]}>
            Futuros
          </Text>
          {tabCounts.future > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{tabCounts.future}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Lista de Agendamentos */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Carregando agendamentos...</Text>
        </View>
      ) : (
        <SectionList
          sections={getActiveAppointments()}
          keyExtractor={(item) => item.id}
          renderItem={renderAppointmentItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {activeTab === 'past' && 'Nenhum agendamento passado'}
                {activeTab === 'today' && 'Nenhum agendamento para hoje'}
                {activeTab === 'future' && 'Nenhum agendamento futuro'}
              </Text>
            </View>
          }
        />
      )}

      {/* Modal para Adicionar/Editar Agendamento */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}
            </Text>

            <Text style={styles.label}>Cliente:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.client_id}
                onValueChange={(itemValue) => setFormData({ ...formData, client_id: itemValue })}
                style={styles.picker}
              >
                {clients.map((client) => (
                  <Picker.Item key={client.id} label={client.name} value={client.id} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Serviço:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.service_id}
                onValueChange={(itemValue) => setFormData({ ...formData, service_id: itemValue })}
                style={styles.picker}
              >
                {services.map((service) => (
                  <Picker.Item key={service.id} label={service.name} value={service.id} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Data e Hora:</Text>
            <View style={styles.dateTimeContainer}>
              <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateTimeButton}>
                <Text>{formData.appointment_time.toLocaleDateString('pt-BR')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.dateTimeButton}>
                <Text>{formData.appointment_time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={formData.appointment_time}
                mode="date"
                display="default"
                onChange={onDateChange}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={formData.appointment_time}
                mode="time"
                display="default"
                onChange={onTimeChange}
              />
            )}

            <Text style={styles.label}>Status:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.status}
                onValueChange={(itemValue) => setFormData({ ...formData, status: itemValue })}
                style={styles.picker}
              >
                <Picker.Item label="Agendado" value="scheduled" />
                <Picker.Item label="Concluído" value="completed" />
                <Picker.Item label="Cancelado" value="cancelled" />
              </Picker>
            </View>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Observações"
              value={formData.notes}
              onChangeText={(text) => setFormData({ ...formData, notes: text })}
              multiline={true}
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={closeModal}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={saveAppointment}
              >
                <Text style={styles.saveButtonText}>
                  {editingAppointment ? 'Atualizar' : 'Salvar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  tabBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 5,
  },
  todayBadge: {
    backgroundColor: '#28a745',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  listContent: {
    paddingBottom: 20,
  },
  monthHeader: {
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
  },
  monthHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    textTransform: 'capitalize',
  },
  sectionHeader: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textTransform: 'capitalize',
  },
  sectionCount: {
    fontSize: 14,
    color: '#666',
  },
  appointmentCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 5,
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  timeContainer: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 15,
  },
  appointmentTime: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentClient: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  appointmentService: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  appointmentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appointmentStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  appointmentPrice: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: 'bold',
  },
  appointmentNotes: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 5,
  },
  appointmentActions: {
    flexDirection: 'column',
    gap: 5,
  },
  actionButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  deleteActionButton: {
    backgroundColor: '#ffe4e4',
  },
  actionButtonText: {
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    fontStyle: 'italic',
  },
  // Estilos do Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
    marginTop: 10,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  dateTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  dateTimeButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default AppointmentsScreen;
