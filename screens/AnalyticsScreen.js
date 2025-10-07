import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { supabase } from '../supabase';

const { width: screenWidth } = Dimensions.get('window');

const AnalyticsScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [analytics, setAnalytics] = useState({
    totalAppointments: 0,
    totalRevenue: 0,
    topServices: [],
    topClientsByVisits: [],
    topClientsByRevenue: [],
    appointmentsByStatus: {},
    appointmentsByDay: [],
    monthlyRevenue: [],
    averageTicket: 0,
    completionRate: 0,
  });

  useEffect(() => {
    fetchAnalytics();
  }, [selectedPeriod]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchGeneralMetrics(),
        fetchTopServices(),
        fetchTopClients(),
        fetchAppointmentsByStatus(),
        fetchAppointmentsTrend(),
        fetchRevenueData(),
      ]);
    } catch (error) {
      console.error('Erro ao buscar analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    let startDate, endDate;

    switch (selectedPeriod) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        endDate = now;
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
    }

    return {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    };
  };

  const fetchGeneralMetrics = async () => {
    const { start, end } = getDateRange();
    
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        status,
        services(price)
      `)
      .gte('appointment_time', start)
      .lte('appointment_time', end);

    if (!error && data) {
      const total = data.length;
      const completed = data.filter(a => a.status === 'completed').length;
      const revenue = data
        .filter(a => a.status === 'completed')
        .reduce((sum, a) => sum + (parseFloat(a.services?.price) || 0), 0);
      
      setAnalytics(prev => ({
        ...prev,
        totalAppointments: total,
        totalRevenue: revenue,
        averageTicket: completed > 0 ? revenue / completed : 0,
        completionRate: total > 0 ? (completed / total) * 100 : 0,
      }));
    }
  };

  const fetchTopServices = async () => {
    const { start, end } = getDateRange();
    
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        service_id,
        services(id, name, price)
      `)
      .gte('appointment_time', start)
      .lte('appointment_time', end)
      .eq('status', 'completed');

    if (!error && data) {
      const serviceCount = {};
      data.forEach(appointment => {
        if (appointment.services) {
          const serviceId = appointment.services.id;
          if (!serviceCount[serviceId]) {
            serviceCount[serviceId] = {
              name: appointment.services.name,
              count: 0,
              revenue: 0,
            };
          }
          serviceCount[serviceId].count++;
          serviceCount[serviceId].revenue += parseFloat(appointment.services.price) || 0;
        }
      });

      const topServices = Object.values(serviceCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setAnalytics(prev => ({ ...prev, topServices }));
    }
  };

  const fetchTopClients = async () => {
    const { start, end } = getDateRange();
    
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        client_id,
        clients(id, name),
        services(price)
      `)
      .gte('appointment_time', start)
      .lte('appointment_time', end)
      .eq('status', 'completed');

    if (!error && data) {
      const clientData = {};
      data.forEach(appointment => {
        if (appointment.clients) {
          const clientId = appointment.clients.id;
          if (!clientData[clientId]) {
            clientData[clientId] = {
              name: appointment.clients.name,
              visits: 0,
              totalSpent: 0,
            };
          }
          clientData[clientId].visits++;
          clientData[clientId].totalSpent += parseFloat(appointment.services?.price) || 0;
        }
      });

      const topClientsByVisits = Object.values(clientData)
        .sort((a, b) => b.visits - a.visits);

      const topClientsByRevenue = Object.values(clientData)
        .sort((a, b) => b.totalSpent - a.totalSpent);

      setAnalytics(prev => ({ ...prev, topClientsByVisits, topClientsByRevenue }));
    }
  };

  const fetchAppointmentsByStatus = async () => {
    const { start, end } = getDateRange();
    
    const { data, error } = await supabase
      .from('appointments')
      .select('status')
      .gte('appointment_time', start)
      .lte('appointment_time', end);

    if (!error && data) {
      const statusCount = {
        scheduled: 0,
        completed: 0,
        cancelled: 0,
      };

      data.forEach(appointment => {
        if (statusCount.hasOwnProperty(appointment.status)) {
          statusCount[appointment.status]++;
        }
      });

      setAnalytics(prev => ({ ...prev, appointmentsByStatus: statusCount }));
    }
  };

  const fetchAppointmentsTrend = async () => {
    const { start, end } = getDateRange();
    
    const { data, error } = await supabase
      .from('appointments')
      .select('appointment_time, status')
      .gte('appointment_time', start)
      .lte('appointment_time', end)
      .order('appointment_time');

    if (!error && data) {
      const dailyData = {};
      
      data.forEach(appointment => {
        const date = new Date(appointment.appointment_time).toLocaleDateString('pt-BR');
        if (!dailyData[date]) {
          dailyData[date] = { total: 0, completed: 0 };
        }
        dailyData[date].total++;
        if (appointment.status === 'completed') {
          dailyData[date].completed++;
        }
      });

      const appointmentsByDay = Object.entries(dailyData)
        .map(([date, data]) => ({
          date,
          ...data,
        }))
        .slice(-7);

      setAnalytics(prev => ({ ...prev, appointmentsByDay }));
    }
  };

  const fetchRevenueData = async () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        appointment_time,
        services(price)
      `)
      .gte('appointment_time', startOfYear.toISOString())
      .lte('appointment_time', now.toISOString())
      .eq('status', 'completed');

    if (!error && data) {
      const monthlyData = {};
      
      data.forEach(appointment => {
        const month = new Date(appointment.appointment_time).toLocaleDateString('pt-BR', { month: 'short' });
        if (!monthlyData[month]) {
          monthlyData[month] = 0;
        }
        monthlyData[month] += parseFloat(appointment.services?.price) || 0;
      });

      const monthlyRevenue = Object.entries(monthlyData)
        .map(([month, revenue]) => ({
          month,
          revenue,
        }));

      setAnalytics(prev => ({ ...prev, monthlyRevenue }));
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const SimpleBarChart = ({ data, maxValue, height = 150 }) => {
    if (!data || data.length === 0) return null;

    return (
      <View style={[styles.barChartContainer, { height }]}>
        <View style={styles.barChartBars}>
          {data.map((item, index) => {
            const barHeight = maxValue > 0 ? (item.total / maxValue) * (height - 30) : 0;
            const completedHeight = maxValue > 0 ? (item.completed / maxValue) * (height - 30) : 0;
            
            return (
              <View key={index} style={styles.barColumn}>
                <Text style={styles.barValue}>{item.total}</Text>
                <View style={styles.barWrapper}>
                  <View style={[styles.bar, { height: barHeight, backgroundColor: '#e0e0e0' }]}>
                    <View style={[styles.barFilled, { height: completedHeight }]} />
                  </View>
                </View>
                <Text style={styles.barLabel}>
                  {item.date.split('/')[0]}/{item.date.split('/')[1]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Carregando dados...</Text>
      </View>
    );
  }

  const pieChartData = [
    {
      name: 'Agendado',
      population: analytics.appointmentsByStatus.scheduled || 0,
      color: '#007AFF',
      legendFontColor: '#7F7F7F',
      legendFontSize: 15,
    },
    {
      name: 'Concluído',
      population: analytics.appointmentsByStatus.completed || 0,
      color: '#28a745',
      legendFontColor: '#7F7F7F',
      legendFontSize: 15,
    },
    {
      name: 'Cancelado',
      population: analytics.appointmentsByStatus.cancelled || 0,
      color: '#dc3545',
      legendFontColor: '#7F7F7F',
      legendFontSize: 15,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Análise e Relatórios</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.periodSelector}>
        <TouchableOpacity
          style={[styles.periodButton, selectedPeriod === 'week' && styles.periodButtonActive]}
          onPress={() => setSelectedPeriod('week')}
        >
          <Text style={[styles.periodButtonText, selectedPeriod === 'week' && styles.periodButtonTextActive]}>
            Semana
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, selectedPeriod === 'month' && styles.periodButtonActive]}
          onPress={() => setSelectedPeriod('month')}
        >
          <Text style={[styles.periodButtonText, selectedPeriod === 'month' && styles.periodButtonTextActive]}>
            Mês
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, selectedPeriod === 'year' && styles.periodButtonActive]}
          onPress={() => setSelectedPeriod('year')}
        >
          <Text style={[styles.periodButtonText, selectedPeriod === 'year' && styles.periodButtonTextActive]}>
            Ano
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Métricas Principais */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{analytics.totalAppointments}</Text>
            <Text style={styles.metricLabel}>Agendamentos</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{formatCurrency(analytics.totalRevenue)}</Text>
            <Text style={styles.metricLabel}>Receita Total</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{formatCurrency(analytics.averageTicket)}</Text>
            <Text style={styles.metricLabel}>Ticket Médio</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{analytics.completionRate.toFixed(1)}%</Text>
            <Text style={styles.metricLabel}>Taxa Conclusão</Text>
          </View>
        </View>

        {/* Gráfico de Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status dos Agendamentos</Text>
          {analytics.totalAppointments > 0 ? (
            <PieChart
              data={pieChartData}
              width={screenWidth - 40}
              height={220}
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                decimalPlaces: 0, // optional, defaults to 2dp
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '6',
                  strokeWidth: '2',
                  stroke: '#ffa726',
                },
              }}
              accessor={'population'}
              backgroundColor={'transparent'}
              paddingLeft={'15'}
              absolute
            />
          ) : (
            <Text style={styles.emptyText}>Nenhum agendamento no período para gerar o gráfico.</Text>
          )}
        </View>

        {/* Gráfico de Tendência */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tendência de Agendamentos (7 dias)</Text>
          <SimpleBarChart 
            data={analytics.appointmentsByDay}
            maxValue={Math.max(...analytics.appointmentsByDay.map(d => d.total), 1)}
          />
        </View>

        {/* Top Serviços */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top 5 Serviços</Text>
          {analytics.topServices.map((service, index) => (
            <View key={index} style={styles.rankingItem}>
              <View style={styles.rankingInfo}>
                <Text style={styles.rankingPosition}>#{index + 1}</Text>
                <Text style={styles.rankingName}>{service.name}</Text>
              </View>
              <View style={styles.rankingStats}>
                <Text style={styles.rankingCount}>{service.count}x</Text>
                <Text style={styles.rankingRevenue}>{formatCurrency(service.revenue)}</Text>
              </View>
            </View>
          ))}
          {analytics.topServices.length === 0 && (
            <Text style={styles.emptyText}>Nenhum serviço completado no período</Text>
          )}
        </View>

        {/* Top Clientes por Visitas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Clientes (visitas concluídas)</Text>
          <ScrollView style={styles.rankingScroll} nestedScrollEnabled={true}>
            {analytics.topClientsByVisits.map((client, index) => (
              <View key={index} style={styles.rankingItem}>
                <View style={styles.rankingInfo}>
                  <Text style={styles.rankingPosition}>#{index + 1}</Text>
                  <Text style={styles.rankingName}>{client.name}</Text>
                </View>
                <View style={styles.rankingStats}>
                  <Text style={styles.rankingCount}>{client.visits} visitas</Text>
                </View>
              </View>
            ))}
            {analytics.topClientsByVisits.length === 0 && (
              <Text style={styles.emptyText}>Nenhum cliente com visitas concluídas no período</Text>
            )}
          </ScrollView>
        </View>

        {/* Top Clientes por Receita */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Clientes (receitas geradas)</Text>
          <ScrollView style={styles.rankingScroll} nestedScrollEnabled={true}>
            {analytics.topClientsByRevenue.map((client, index) => (
              <View key={index} style={styles.rankingItem}>
                <View style={styles.rankingInfo}>
                  <Text style={styles.rankingPosition}>#{index + 1}</Text>
                  <Text style={styles.rankingName}>{client.name}</Text>
                </View>
                <View style={styles.rankingStats}>
                  <Text style={styles.rankingRevenue}>{formatCurrency(client.totalSpent)}</Text>
                </View>
              </View>
            ))}
            {analytics.topClientsByRevenue.length === 0 && (
              <Text style={styles.emptyText}>Nenhum cliente com receita gerada no período</Text>
            )}
          </ScrollView>
        </View>

      </ScrollView>
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
  placeholder: {
    width: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  periodButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 5,
  },
  periodButtonActive: {
    backgroundColor: '#007AFF',
  },
  periodButtonText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  content: {
    padding: 10,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  metricCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    width: screenWidth / 4 - 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  metricLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  pieChartContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  pieChart: {
    width: 150,
    height: 150,
    borderRadius: 75,
    position: 'relative',
    overflow: 'hidden',
  },
  pieSlice: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    clipPath: 'polygon(50% 50%, 50% 0, 100% 0, 100% 50%)',
  },
  pieSliceInner: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'inherit',
    clipPath: 'polygon(50% 50%, 50% 0, 0 0, 0 50%)',
  },
  pieLegend: {
    marginLeft: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendText: {
    fontSize: 14,
    color: '#333',
  },
  barChartContainer: {
    marginTop: 10,
  },
  barChartBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: '100%',
  },
  barColumn: {
    alignItems: 'center',
    width: 40,
  },
  barValue: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  barWrapper: {
    flex: 1,
    width: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
  },
  barFilled: {
    width: '100%',
    backgroundColor: '#28a745',
  },
  barLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 5,
  },
  rankingScroll: {
    maxHeight: 200,
  },
  rankingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rankingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rankingPosition: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999',
    width: 30,
  },
  rankingName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  rankingStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankingCount: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  rankingRevenue: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    marginTop: 10,
  },
});

export default AnalyticsScreen;
