import django_filters

from .models import Problem


class ProblemFilter(django_filters.FilterSet):
    difficulty = django_filters.CharFilter(lookup_expr='exact')
    tag = django_filters.CharFilter(field_name='tags__slug', lookup_expr='exact')
    search = django_filters.CharFilter(field_name='title', lookup_expr='icontains')

    class Meta:
        model = Problem
        fields = []
